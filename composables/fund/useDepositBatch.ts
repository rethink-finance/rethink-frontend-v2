import { ethers } from "ethers";
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import {
  getAtomicBatchStatus,
  isBatchUnsupportedError,
  isUpgradeRejectionError,
  isUserRejectionError,
  isWalletCallsSuccess,
  isWalletRpcHealthError,
  sendWalletCalls,
  waitForWalletCalls,
  WALLET_RPC_HEALTH_MESSAGE,
  WalletCallsTimeoutError,
  type WalletBatchCall,
} from "~/services/eip5792";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import { useDepositFlowBatchPending } from "~/composables/fund/useDepositFlow";

/**
 * The first three deposit steps — requestDeposit, approve, delegate — as one
 * wallet confirmation, for wallets that can execute an EIP-5792 batch from
 * the depositor's own account. Callers act on the outcome:
 *
 *   "success"      the batch landed; store state already reflects all steps.
 *   "unsupported"  this wallet/chain cannot batch — run the per-transaction
 *                  flow instead. Nothing was shown to the user.
 *   "stopped"      the user declined, or the batch failed; the toasts are
 *                  already up and nothing further should run.
 *
 * The fourth step, processing, is not in the batch by design: the protocol
 * requires a NAV update after the request before a deposit can process, so it
 * cannot share a transaction with the request that starts the clock.
 */
export type DepositBatchOutcome = "success" | "unsupported" | "stopped";

const FUND_FLOWS_CALL_INTERFACE = new ethers.Interface([
  "function fundFlowsCall(bytes flowCall)",
]);
const ERC20_APPROVE_INTERFACE = new ethers.Interface([
  "function approve(address spender, uint256 amount)",
]);
const VOTES_DELEGATE_INTERFACE = new ethers.Interface([
  "function delegate(address delegatee)",
]);

const successToastText = (
  includesApprove: boolean,
  includesDelegate: boolean,
) => {
  const parts = [
    "deposit request",
    ...(includesApprove ? ["approval"] : []),
    ...(includesDelegate ? ["delegation"] : []),
  ];
  if (parts.length === 1) return "Your deposit request was successful.";
  const steps = `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Your ${steps} were confirmed in one transaction.`;
};

export const useDepositBatch = () => {
  const accountStore = useAccountStore();
  const fundStore = useFundStore();
  const toastStore = useToastStore();

  const isDepositBatchPending = useDepositFlowBatchPending(
    () => fundStore.selectedFundAddress,
  );

  /**
   * A wallet in the "ready" state offers an account upgrade inside the batch
   * confirmation. Someone who refused it chose to stay a plain EOA — the
   * offer is not repeated this session, and their deposits go transaction by
   * transaction. Keyed by chain because the upgrade is per chain.
   */
  const upgradeDeclinedForChain = useState<Record<string, boolean>>(
    "deposit-batch-upgrade-declined",
    () => ({}),
  );

  /**
   * Probe results, so the step rail can be shaped before anything is clicked.
   * Keyed by wallet + chain + account: the same account imported into two
   * wallets can batch in one and not the other, and the capability is
   * per chain besides.
   */
  const batchSupportByKey = useState<Record<string, boolean>>(
    "deposit-batch-support",
    () => ({}),
  );

  const batchSupportKey = computed<string | undefined>(() => {
    const walletLabel = accountStore.connectedWallet?.label;
    const account = fundStore.activeAccountAddress?.toLowerCase();
    const chainId = fundStore.selectedFundChain;
    if (!walletLabel || !account || !chainId) return undefined;
    return `${walletLabel}:${chainId}:${account}`;
  });

  /**
   * Whether the connected wallet batches on this vault's chain — the thing
   * the UI keys the rail's shape on. `false` covers "cannot", "not connected"
   * and "declined the account upgrade"; `undefined` means the probe has not
   * answered yet, which callers should render the same as false so the rail
   * never promises one confirmation it cannot deliver.
   */
  const isBatchSupported = computed<boolean | undefined>(() => {
    const key = batchSupportKey.value;
    if (!key) return false;
    if (upgradeDeclinedForChain.value[fundStore.selectedFundChain]) return false;
    return batchSupportByKey.value[key];
  });

  const recordBatchSupport = (supported: boolean) => {
    const key = batchSupportKey.value;
    if (!key || batchSupportByKey.value[key] === supported) return;
    batchSupportByKey.value = { ...batchSupportByKey.value, [key]: supported };
  };

  /**
   * Ask the wallet, for the rail's sake. Passive: never toasts, and a wallet
   * whose RPC is momentarily failing leaves the answer unknown rather than
   * writing down "cannot batch" for the rest of the session.
   */
  const refreshBatchSupport = async (): Promise<void> => {
    const key = batchSupportKey.value;
    const provider = accountStore.connectedWallet?.provider;
    const userAddress = fundStore.activeAccountAddress;
    if (!key || !provider || !userAddress) return;
    if (batchSupportByKey.value[key] !== undefined) return;
    try {
      const status = await getAtomicBatchStatus(
        provider,
        userAddress,
        fundStore.selectedFundChain,
      );
      recordBatchSupport(status !== "unsupported");
    } catch {
      // Wallet RPC health trouble — no verdict.
    }
  };

  /**
   * The batch mirrors what the three standalone actions would send, and skips
   * what is already in place: an allowance from an earlier cancelled flow, or
   * a standing self-delegation. Skipped steps also must not have their store
   * state overwritten on success — hence the flags alongside the calls.
   */
  const buildCalls = (
    amountWei: bigint,
  ): {
    calls: WalletBatchCall[];
    includesApprove: boolean;
    includesDelegate: boolean;
  } => {
    const fund = fundStore.fund!;
    const userAddress = fundStore.activeAccountAddress!;

    const calls: WalletBatchCall[] = [
      {
        to: fund.address,
        data: FUND_FLOWS_CALL_INTERFACE.encodeFunctionData("fundFlowsCall", [
          encodeFundFlowsCallFunctionData("requestDeposit", [amountWei]),
        ]),
      },
    ];

    const includesApprove =
      (fundStore.fundUserData.fundAllowance ?? 0n) < amountWei;
    if (includesApprove) {
      calls.push({
        to: fund.baseToken.address,
        data: ERC20_APPROVE_INTERFACE.encodeFunctionData("approve", [
          fund.address,
          amountWei,
        ]),
      });
    }

    const delegateAddress = fundStore.fundUserData.fundDelegateAddress;
    const includesDelegate =
      !delegateAddress ||
      delegateAddress.toLowerCase() !== userAddress.toLowerCase();
    if (includesDelegate) {
      // Same target rule as the standalone "Delegate to myself" action: the
      // vault token itself unless the vault names an external votes token.
      const governanceTokenAddress = fund.governanceToken.address;
      let delegateTarget = fund.address;
      if (
        governanceTokenAddress !== fund.address &&
        governanceTokenAddress !== ethers.ZeroAddress
      ) {
        delegateTarget = governanceTokenAddress;
      }
      calls.push({
        to: delegateTarget,
        data: VOTES_DELEGATE_INTERFACE.encodeFunctionData("delegate", [
          userAddress,
        ]),
      });
    }

    return { calls, includesApprove, includesDelegate };
  };

  const sendDepositBatch = async (
    amountWei: bigint,
  ): Promise<DepositBatchOutcome> => {
    if (isDepositBatchPending.value) return "stopped";

    const userAddress = fundStore.activeAccountAddress;
    const provider = accountStore.connectedWallet?.provider;
    const chainId = fundStore.selectedFundChain;

    if (!userAddress || !provider) {
      toastStore.errorToast("Connect your wallet to request deposit.");
      return "stopped";
    }
    if (!fundStore.fund?.address) {
      toastStore.errorToast("Fund data is missing.");
      return "stopped";
    }
    if (amountWei <= 0n) {
      toastStore.errorToast("Value must be positive.");
      return "stopped";
    }

    if (upgradeDeclinedForChain.value[chainId]) return "unsupported";
    let atomicStatus;
    try {
      atomicStatus = await getAtomicBatchStatus(provider, userAddress, chainId);
    } catch (error) {
      // The probe only throws when the wallet's RPC endpoint is failing.
      // "unsupported" here would be a lie that routes the user into the
      // per-transaction path to die on the same endpoint — stop with the
      // remedy instead.
      console.error("Wallet RPC failing during capability probe:", error);
      toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
      return "stopped";
    }
    recordBatchSupport(atomicStatus !== "unsupported");
    if (atomicStatus === "unsupported") return "unsupported";

    // The wallet has to be on the vault's chain before it is asked to sign,
    // exactly as CustomContract.ensureCorrectNetwork does for single sends. A
    // refused switch stops this path the same way it stops that one, and
    // switchNetwork has already raised its own toast.
    try {
      if (chainId !== accountStore.connectedWalletChainId) {
        await accountStore.switchNetwork(chainId);
      }
    } catch (error) {
      console.error("Network switch failed before deposit batch:", error);
      return "stopped";
    }

    isDepositBatchPending.value = true;

    try {
      const { calls, includesApprove, includesDelegate } =
        buildCalls(amountWei);
      let batchId: string;
      try {
        batchId = await sendWalletCalls(provider, {
          chainId,
          from: userAddress,
          calls,
        });
      } catch (error: any) {
        if (isUpgradeRejectionError(error)) {
          upgradeDeclinedForChain.value = {
            ...upgradeDeclinedForChain.value,
            [chainId]: true,
          };
          return "unsupported";
        }
        if (isBatchUnsupportedError(error)) return "unsupported";
        if (isUserRejectionError(error)) {
          toastStore.addToast("Transaction was rejected.");
          return "stopped";
        }
        if (isWalletRpcHealthError(error)) {
          // Nothing was signed; the wallet's own RPC refused to build the
          // batch. A sequential fallback would die on the same endpoint, so
          // hand the user the actual remedy instead.
          console.error("Wallet RPC circuit breaker open:", error);
          toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
          return "stopped";
        }
        throw error;
      }

      toastStore.addToast(
        "The transaction has been submitted. Please wait for it to be confirmed.",
      );
      const result = await waitForWalletCalls(provider, batchId);

      if (isWalletCallsSuccess(result)) {
        // The same store writes the three individual receipt handlers make,
        // so the step rail and the pending-requests card flip without waiting
        // on a node refetch.
        fundStore.fundUserData.depositRequest = {
          amount: amountWei,
          timestamp: Date.now(),
          type: FundTransactionType.Deposit,
        };
        if (includesApprove) {
          fundStore.fundUserData.fundAllowance = amountWei;
        }
        if (includesDelegate) {
          fundStore.fundUserData.fundDelegateAddress = userAddress;
        }
        toastStore.successToast(
          successToastText(includesApprove, includesDelegate),
        );
        return "success";
      }

      toastStore.errorToast(
        "The transaction has failed. Please contact the Rethink Finance support.",
      );
      fundStore.fetchUserFundData(
        fundStore.selectedFundChain,
        fundStore.selectedFundAddress,
      );
      return "stopped";
    } catch (error: any) {
      if (error instanceof WalletCallsTimeoutError) {
        // Not a failure — the bundle may still land. Refresh so whatever did
        // happen shows, rather than claiming an error the chain may refute.
        toastStore.addToast(
          "The transaction is taking longer than expected. Your deposit data will refresh once it confirms.",
        );
      } else if (isWalletRpcHealthError(error)) {
        console.error("Deposit batch failed on wallet RPC health:", error);
        toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
      } else {
        console.error("Deposit batch failed:", error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      }
      fundStore.fetchUserFundData(
        fundStore.selectedFundChain,
        fundStore.selectedFundAddress,
      );
      return "stopped";
    } finally {
      isDepositBatchPending.value = false;
    }
  };

  return {
    isDepositBatchPending,
    isBatchSupported,
    refreshBatchSupport,
    sendDepositBatch,
  };
};
