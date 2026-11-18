<template>
  <div class="test_funds">
    <!-- Same segmented control as the vault page's Deposit / Redeem card:
         one form, two directions. -->
    <UiButtonSwitchItems
      v-model="direction"
      :items="directionItems"
      :disabled="isBusy"
      class="test_funds__switch"
    />

    <!-- A sequential return that stopped after its first confirmation. It
         outranks everything else on the card: Finalize waits on it. -->
    <div v-if="isRoleOpen" class="test_funds__alert" role="alert">
      <Icon
        icon="material-symbols:warning-outline-rounded"
        width="1.125rem"
        class="test_funds__alert_icon"
        aria-hidden="true"
      />
      <div class="test_funds__alert_body">
        <strong>A return permission is still open.</strong>
        An earlier return stopped before its last step. Remove it before you
        finalize.
        <v-btn
          class="test_funds__alert_button"
          variant="outlined"
          size="small"
          :loading="isRemovingRole"
          :disabled="isBusy"
          @click="removeOpenRole"
        >
          Remove permission
        </v-btn>
      </div>
    </div>

    <!-- Each balance names the account that holds it. The Safe's carries the
         copy action, since it can be funded from any wallet. -->
    <FundSettlementBaseForm
      :key="direction"
      v-model="amount"
      :token0="token"
      :token1="token"
      :token0-user-balance="sourceBalance ?? 0n"
      :token1-user-balance="destinationBalance ?? 0n"
      :rules="amountRules"
      is-one-to-one
    >
      <template #token0-label>
        <OnboardingTestFundsParty v-bind="fromParty" />
      </template>
      <template #token1-label>
        <OnboardingTestFundsParty v-bind="toParty" />
      </template>
    </FundSettlementBaseForm>

    <v-btn
      class="test_funds__button bg-primary text-white"
      :loading="isBusy"
      :disabled="!canSubmit"
      block
      @click="isSend ? sendToSafe() : returnToWallet()"
    >
      {{ isSend ? "Send" : "Return" }} {{ token.symbol }}
    </v-btn>

    <!-- Said on the page, not in a tooltip: a disabled button fires no mouse
         events, so a hover-only explanation is unreachable in exactly the
         state that needs it. -->
    <p v-if="blockedReason" class="test_funds__note test_funds__note--blocked">
      <Icon icon="material-symbols:info-outline-rounded" width="0.9375rem" aria-hidden="true" />
      {{ blockedReason }}
    </p>
    <p v-else-if="!isSend && returnRoute?.mode === 'sequential'" class="test_funds__note">
      <Icon icon="material-symbols:shield-outline-rounded" width="0.9375rem" aria-hidden="true" />
      Your wallet cannot batch, so a guided flow takes you through three
      confirmations: grant a permission for exactly this transfer, send it,
      remove the permission.
    </p>
    <p v-else-if="!isSend" class="test_funds__note">
      <Icon icon="material-symbols:shield-outline-rounded" width="0.9375rem" aria-hidden="true" />
      One transaction: a permission for exactly this transfer is granted,
      used and removed.
    </p>

    <OnboardingReturnFundsModal
      v-if="returnRun"
      v-model="isReturnModalOpen"
      :route="returnRun.route"
      :token-address="tokenAddress"
      :symbol="token.symbol"
      :account="returnRun.account"
      :amount="returnRun.amount"
      :amount-label="returnRun.amountLabel"
      @role-change="isRoleOpen = $event"
      @finished="onReturnFinished"
    />
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { ERC20 } from "assets/contracts/ERC20";
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import type { ChainId } from "~/types/enums/chain_id";
import type IToken from "~/types/token";
import {
  RolesVersion,
  detectRolesVersion,
} from "~/composables/permissions/useRoleExecution";
import {
  buildReturnRevokeEntries,
  buildReturnTestFundsCalls,
} from "~/composables/onboarding/returnTestFundsCalls";
import {
  useReturnTransactions,
  type IReturnRoute,
} from "~/composables/onboarding/useReturnTransactions";
import { isReturnRoleOpen } from "~/composables/onboarding/returnRoleProbe";
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
} from "~/services/eip5792";

/**
 * Test funds for a vault that is initialized but not finalized: send the
 * denomination asset from the connected wallet to the Safe, and return it
 * from the Safe to the wallet once testing is done. The return is the
 * grant → transfer → revoke sequence in
 * composables/onboarding/returnTestFundsCalls: one atomic batch where the
 * wallet can, three transactions where it cannot.
 */

type Direction = "send" | "return";

const emit = defineEmits<{
  /** Whether a return permission is left assigned; Finalize waits on it. */
  (e: "return-role-change", open: boolean): void;
}>();

const toastStore = useToastStore();
const accountStore = useAccountStore();
const web3Store = useWeb3Store();
const createFundStore = useCreateFundStore();
const { fundChainId, fundSettings, fundFactoryContract } =
  storeToRefs(createFundStore);

const direction = ref<Direction>("send");
const directionItems = [
  { key: "send", label: "Send" },
  { key: "return", label: "Return" },
];
const isSend = computed(() => direction.value === "send");

const amount = ref("");
const isBusy = ref(false);

watch(direction, () => {
  amount.value = "";
});

const safeAddress = computed(() => fundSettings?.value?.safe ?? "");
const walletAddress = computed(() => accountStore.activeAccountAddress ?? "");
const tokenAddress = computed(() => fundSettings?.value?.baseToken ?? "");

const token = computed<IToken>(() => ({
  symbol: fundSettings?.value?.baseSymbol ?? "",
  address: tokenAddress.value,
  decimals: fundSettings?.value?.baseDecimals ?? 18,
}));

// The two ends of the transfer, swapped by the direction.
const walletParty = (prefix: string) => ({
  label: `${prefix} wallet`,
  address: walletAddress.value,
});
const safeParty = (prefix: string) => ({
  label: `${prefix} Safe`,
  address: safeAddress.value,
  copyable: true,
});
const fromParty = computed(() =>
  isSend.value ? walletParty("From") : safeParty("From"),
);
const toParty = computed(() =>
  isSend.value ? safeParty("To") : walletParty("To"),
);

const tokenContract = computed(() => {
  if (!tokenAddress.value || !fundChainId.value) return undefined;
  return web3Store.getCustomContract(fundChainId.value, ERC20, tokenAddress.value);
});

// --- Balances --------------------------------------------------------------

const walletBalance = ref<bigint | undefined>(undefined);
const safeBalance = ref<bigint | undefined>(undefined);

const readBalance = async (holder: string): Promise<bigint | undefined> => {
  if (!holder || !tokenContract.value) return undefined;
  try {
    return BigInt(
      await web3Store.callWithRetry(fundChainId.value, () =>
        tokenContract.value?.methods.balanceOf(holder).call(),
      ),
    );
  } catch (error) {
    console.error("Failed reading a test funds balance", error);
    return undefined;
  }
};

const refreshBalances = async () => {
  const [wallet, safe] = await Promise.all([
    readBalance(walletAddress.value),
    readBalance(safeAddress.value),
  ]);
  walletBalance.value = wallet;
  safeBalance.value = safe;
};

// Polled: the asset may also arrive from a wallet that is not connected here.
const BALANCE_POLL_MS = 20_000;
let balanceTimer: ReturnType<typeof setInterval> | undefined;

watch(
  () => [walletAddress.value, safeAddress.value, tokenAddress.value],
  () => {
    if (balanceTimer) clearInterval(balanceTimer);
    refreshBalances();
    balanceTimer = setInterval(refreshBalances, BALANCE_POLL_MS);
  },
  { immediate: true },
);

const sourceBalance = computed(() =>
  isSend.value ? walletBalance.value : safeBalance.value,
);
const destinationBalance = computed(() =>
  isSend.value ? safeBalance.value : walletBalance.value,
);

const amountWei = computed(() => {
  try {
    return ethers.parseUnits(amount.value || "0", token.value.decimals);
  } catch {
    // Mid-typing values ("0.", "1.2.3") land here; the button just stays off.
    return 0n;
  }
});

const amountRules = [
  () =>
    sourceBalance.value === undefined ||
    amountWei.value <= sourceBalance.value ||
    (isSend.value ? "More than your wallet holds." : "More than the Safe holds."),
];

// --- Can the return go out? -------------------------------------------------

const returnRoute = ref<IReturnRoute | undefined>(undefined);
const returnUnavailableReason = ref("");

/**
 * Whether an earlier sequential return stopped after granting the role.
 * Undefined while unknown. Reported up, because Finalize must not run while
 * it is true: after finalize the factory can no longer revoke it.
 */
const isRoleOpen = ref<boolean | undefined>(undefined);
watch(isRoleOpen, (open) => emit("return-role-change", !!open));

const roleParams = () => {
  const route = returnRoute.value;
  if (!route || !walletAddress.value || !tokenAddress.value) return undefined;
  return {
    version: route.version,
    tokenAddress: tokenAddress.value,
    member: walletAddress.value,
  };
};

const refreshRoleState = async () => {
  const route = returnRoute.value;
  const params = roleParams();
  if (!route || !params) {
    isRoleOpen.value = undefined;
    return;
  }
  try {
    isRoleOpen.value = await isReturnRoleOpen({
      chainId: fundChainId.value as ChainId,
      rolesModAddress: route.rolesModAddress,
      ...params,
    });
  } catch (error) {
    // No RPC answered. Unknown is not "open": Finalize re-checks on its own.
    console.warn("Could not check for an open return permission", error);
    isRoleOpen.value = undefined;
  }
};

const resolveReturnRoute = async () => {
  returnRoute.value = undefined;
  returnUnavailableReason.value = "";

  const chainId = fundChainId.value as ChainId;
  const account = walletAddress.value;
  const rolesModAddress = createFundStore.fundInitCache?.rolesModifier ?? "";
  const factoryAddress = fundFactoryContract.value?.options?.address ?? "";

  if (!account) {
    returnUnavailableReason.value = "Connect the wallet that created this vault to return funds.";
    return;
  }
  if (!rolesModAddress || isZeroAddress(rolesModAddress) || !factoryAddress) {
    returnUnavailableReason.value =
      "The vault's Roles modifier is not known yet, so funds cannot be returned from here.";
    return;
  }

  const provider = accountStore.connectedWallet?.provider;
  let canBatch = false;
  if (provider) {
    try {
      canBatch =
        (await getAtomicBatchStatus(provider, account, chainId)) !== "unsupported";
    } catch (error) {
      // The wallet's RPC is failing; the send will surface that on its own.
      console.warn("Batch capability probe failed", error);
      canBatch = true;
    }
  }

  const version = await detectRolesVersion(
    chainId,
    rolesModAddress,
    createFundStore.fundFactoryContractV2Used ? RolesVersion.V2 : RolesVersion.V1,
  );
  returnRoute.value = {
    version: version === RolesVersion.V1 ? "V1" : "V2",
    rolesModAddress,
    factoryAddress,
    mode: canBatch ? "atomic" : "sequential",
  };
  await refreshRoleState();
};

watch(
  () => [
    walletAddress.value,
    accountStore.connectedWallet?.label,
    fundChainId.value,
    createFundStore.fundInitCache?.rolesModifier,
    fundFactoryContract.value?.options?.address,
    tokenAddress.value,
  ],
  () => {
    resolveReturnRoute().catch((error) => {
      console.error("Failed resolving the test funds return route", error);
      returnUnavailableReason.value = "Could not check whether funds can be returned.";
    });
  },
  { immediate: true },
);

// --- Submit -----------------------------------------------------------------

const blockedReason = computed(() => {
  if (isBusy.value) return "";
  if (!walletAddress.value) return "Connect a wallet to move test funds.";
  if (!safeAddress.value) return "The vault's Safe is not known yet.";
  if (!isSend.value && isRoleOpen.value) {
    return "Remove the open return permission above before returning again.";
  }
  if (!isSend.value) return returnUnavailableReason.value;
  return "";
});

const canSubmit = computed(
  () =>
    !isBusy.value &&
    !blockedReason.value &&
    !!tokenContract.value &&
    amountWei.value > 0n &&
    (sourceBalance.value === undefined || amountWei.value <= sourceBalance.value) &&
    (isSend.value || !!returnRoute.value),
);

const SUBMITTED_TOAST =
  "The transaction has been submitted. Please wait for it to be confirmed.";

const sendToSafe = async () => {
  if (!canSubmit.value || !tokenContract.value) return;
  isBusy.value = true;
  const sent = amount.value;

  try {
    await tokenContract.value
      .send("transfer", {}, safeAddress.value, amountWei.value)
      .on("transactionHash", () => toastStore.addToast(SUBMITTED_TOAST))
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast(`Sent ${sent} ${token.value.symbol} to the vault's Safe.`);
          amount.value = "";
        } else {
          toastStore.errorToast("The transfer has failed.");
        }
        refreshBalances();
        isBusy.value = false;
      })
      .on("error", (error: any) => {
        console.error("error sending test funds", error);
        isBusy.value = false;
        if (error?.code !== 4001) toastStore.errorToast("The transfer has failed.");
      });
  } catch (error: any) {
    console.error(error);
    isBusy.value = false;
  }
};

const { ensureChain, submitPermissions } = useReturnTransactions();

/** Remove the role; true once the revoke is mined. */
const revokeRole = async (): Promise<boolean> => {
  const params = roleParams();
  if (!params) return false;
  const outcome = await submitPermissions(buildReturnRevokeEntries(params));
  if (outcome === "confirmed") {
    isRoleOpen.value = false;
    return true;
  }
  if (outcome === "rejected") toastStore.addToast("Transaction was rejected.");
  else toastStore.errorToast("Removing the permission failed. Please try again.");
  return false;
};

// --- Guided return, for wallets that cannot batch ---------------------------

/** What the modal works on, frozen when it opens. */
const returnRun = ref<
  | { route: IReturnRoute; account: string; amount: bigint; amountLabel: string }
  | undefined
>(undefined);
const isReturnModalOpen = ref(false);

const openReturnModal = (route: IReturnRoute, account: string) => {
  returnRun.value = {
    route,
    account,
    amount: amountWei.value,
    amountLabel: amount.value,
  };
  isReturnModalOpen.value = true;
};

const onReturnFinished = (transferred: boolean) => {
  if (transferred) amount.value = "";
  refreshBalances();
};

watch(isReturnModalOpen, (open) => {
  if (!open) refreshBalances();
});

const returnAtomically = async (route: IReturnRoute, account: string, provider: any) => {
  const chainId = fundChainId.value as ChainId;
  const sent = amount.value;

  let batchId: string;
  try {
    batchId = await sendWalletCalls(provider, {
      chainId,
      from: account,
      calls: buildReturnTestFundsCalls({
        ...route,
        tokenAddress: tokenAddress.value,
        member: account,
        recipient: account,
        amount: amountWei.value,
      }),
    });
  } catch (error: any) {
    if (isUpgradeRejectionError(error) || isBatchUnsupportedError(error)) {
      // The wallet turned the batch down: walk through it one call at a time.
      returnRoute.value = { ...route, mode: "sequential" };
      openReturnModal(returnRoute.value, account);
      return;
    }
    if (isUserRejectionError(error)) {
      toastStore.addToast("Transaction was rejected.");
      return;
    }
    console.error("Return batch was not sent", error);
    toastStore.errorToast(
      isWalletRpcHealthError(error)
        ? WALLET_RPC_HEALTH_MESSAGE
        : "The wallet could not send the return. Only the wallet that created the vault can return funds before it is finalized.",
    );
    return;
  }

  toastStore.addToast(SUBMITTED_TOAST);
  try {
    const result = await waitForWalletCalls(provider, batchId);
    if (isWalletCallsSuccess(result)) {
      toastStore.successToast(`Returned ${sent} ${token.value.symbol} to your wallet.`);
      amount.value = "";
    } else {
      // Atomic: nothing was granted, nothing moved.
      toastStore.errorToast("Returning the funds has failed. Nothing was changed.");
    }
  } catch (error: any) {
    if (error instanceof WalletCallsTimeoutError) {
      toastStore.addToast(
        "The transaction is taking longer than expected. The balances update once it confirms.",
      );
    } else if (isWalletRpcHealthError(error)) {
      toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
    } else {
      console.error("Return batch failed", error);
      toastStore.errorToast("There has been an error returning the funds.");
    }
  }
};

const returnToWallet = async () => {
  const route = returnRoute.value;
  const provider = accountStore.connectedWallet?.provider;
  const account = walletAddress.value;
  if (!canSubmit.value || !route || !account) return;

  // No batching: the guided flow sends each confirmation from its own button.
  if (route.mode === "sequential" || !provider) {
    openReturnModal(route, account);
    return;
  }

  isBusy.value = true;
  try {
    if (!(await ensureChain())) return;
    await returnAtomically(route, account, provider);
  } finally {
    refreshBalances();
    isBusy.value = false;
  }
};

/** Remove a role an earlier sequential return left assigned. */
const isRemovingRole = ref(false);
const removeOpenRole = async () => {
  if (isRemovingRole.value || isBusy.value) return;
  isRemovingRole.value = true;
  try {
    if (!(await ensureChain())) return;
    if (await revokeRole()) {
      toastStore.successToast("The return permission has been removed.");
    }
  } finally {
    isRemovingRole.value = false;
  }
};

defineExpose({ refreshRoleState });

onBeforeUnmount(() => {
  if (balanceTimer) clearInterval(balanceTimer);
});
</script>

<style scoped lang="scss">
.test_funds {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  padding: 1.25rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;

  /* The vault page's Deposit / Redeem segmented control, restated here
     because that card scopes it to itself. */
  &__switch {
    width: 100%;
    padding: 0;
    gap: 0;
    background-color: transparent;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    overflow: hidden;

    :deep(.v-btn) {
      min-width: 0;
      height: auto;
      padding: 0.5rem 0.75rem;
      border-radius: 0;
      font-family: $font-mono;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;

      + .v-btn {
        border-left: 1px solid $color-line-2;
      }

      &.active {
        color: $color-cyan !important;
        background-color: $color-accent-soft;
      }
    }
  }

  /* One quiet line under the button: why it is off, or what Return does. */
  &__note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: -0.25rem 0 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-text-irrelevant;

    svg {
      flex: none;
      margin-top: 0.125rem;
      color: $color-steel-blue;
    }

    &--blocked {
      color: $color-steel-blue;

      svg {
        color: $color-warn;
      }
    }
  }

  /* The open-permission warning, in the flow's "act before you finalize"
     tone: the same amber the step's own notice uses. */
  &__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;

    strong {
      display: block;
      font-weight: 600;
      color: $color-white;
    }
  }

  &__alert_icon {
    flex: none;
    margin-top: 0.0625rem;
    color: $color-warn;
  }

  &__alert_body {
    flex: 1;
    min-width: 0;
  }

  &__alert_button {
    display: flex;
    margin-top: 0.625rem;
    text-transform: none;
    letter-spacing: 0.01em;
  }

  &__button {
    height: 42px !important;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-transform: none;
  }
}
</style>
