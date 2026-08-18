import { encodeFunctionCall } from "web3-eth-abi";
import type { AbiFunctionFragment } from "web3";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * One-time per-vault activation of the manager permissions that are inert
 * after creation:
 *
 * 1. updateSettings requires msg.sender == FundSettings.governor. Manager
 *    calls arrive through the Roles modifier as the SAFE, so the
 *    "update vault settings" permission only works once governance has set
 *    governor = safe.
 * 2. The Roles modifier's admin functions (assignRoles, scope*, ...) are
 *    onlyOwner, and the owner after creation is the Governor. The
 *    "manage role members" permission only works once governance has run
 *    rolesModifier.transferOwnership(safe).
 *
 * Both are folded into a single governance proposal here.
 */

export interface IActivationState {
  governor: string;
  safe: string;
  modifierOwner: string | null;
  needsGovernorMigration: boolean;
  needsOwnershipTransfer: boolean;
}

const updateSettingsAbi = GovernableFund.abi.find(
  (f: any) => f.type === "function" && f.name === "updateSettings",
) as AbiFunctionFragment;

const transferOwnershipAbi = (RolesFullV2 as any).abi.find(
  (f: any) => f?.type === "function" && f?.name === "transferOwnership",
);

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Live reads only — never derive this from cached frontend state.
 */
export const fetchActivationState = async (
  chainId: ChainId,
  fundAddress: string,
  rolesModifierAddress: string | null,
): Promise<IActivationState> => {
  const web3Store = useWeb3Store();
  const fundContract = web3Store.getCustomContract(
    chainId,
    GovernableFund.abi as any,
    fundAddress,
  );
  // Both reads through callWithRetry, and side by side: the owner lookup needs
  // nothing from the settings, and a bare .call() has neither a timeout nor a
  // second RPC to fall to — on a chain whose endpoints stall (HyperEVM meters
  // every request against one quota) that is the difference between a page
  // that paints and one that hangs on a single provider.
  const [settings, modifierOwner] = await Promise.all([
    web3Store.callWithRetry(chainId, () =>
      fundContract.methods.getFundSettings().call(),
    ) as Promise<Record<string, any>>,
    (async (): Promise<string | null> => {
      if (!rolesModifierAddress) return null;
      try {
        const rolesContract = web3Store.getCustomContract(
          chainId,
          (RolesFullV2 as any).abi,
          rolesModifierAddress,
        );
        return (await web3Store.callWithRetry(chainId, () =>
          rolesContract.methods.owner().call(),
        )) as string;
      } catch (e) {
        console.error("Failed reading roles modifier owner", e);
        return null;
      }
    })(),
  ]);

  const governor = settings.governor as string;
  const safe = settings.safe as string;
  return {
    governor,
    safe,
    modifierOwner,
    needsGovernorMigration: !eq(governor, safe),
    // Owner already being the safe means transferred; owner being anything
    // else (the governor) means the transfer is still pending.
    needsOwnershipTransfer:
      modifierOwner !== null && !eq(modifierOwner, safe),
  };
};

export interface IProposalActions {
  targets: string[];
  gasValues: number[];
  calldatas: string[];
}

/**
 * Build the activation proposal actions. All pinned/echoed values are read
 * LIVE from the fund at build time:
 *
 * - updateSettings(echo of every current value, EXCEPT governor = safe, AND
 *   allowedDepositAddrs = [] and allowedManagers = []). The two arrays MUST
 *   be empty: updateSettings XOR-toggles each passed address in the
 *   underlying whitelist mappings, so echoing the stored arrays would flip
 *   every currently whitelisted depositor OFF.
 * - rolesModifier.transferOwnership(safe) when the members permission gate
 *   is still pending.
 */
export const buildActivationProposalActions = async (
  chainId: ChainId,
  fundAddress: string,
  rolesModifierAddress: string | null,
  // The RethinkFundGovernor that will execute this proposal. Used to catch
  // a modifier owned by an unexpected third address before proposing a
  // transferOwnership that could never execute.
  executingGovernorAddress?: string,
): Promise<{ actions: IProposalActions; state: IActivationState }> => {
  const web3Store = useWeb3Store();
  const state = await fetchActivationState(
    chainId,
    fundAddress,
    rolesModifierAddress,
  );

  const targets: string[] = [];
  const gasValues: number[] = [];
  const calldatas: string[] = [];

  if (state.needsGovernorMigration) {
    const fundContract = web3Store.getCustomContract(
      chainId,
      GovernableFund.abi as any,
      fundAddress,
    );
    const [settings, fundMetadata, feePerformancePeriod, feeManagePeriod] =
      await Promise.all([
        fundContract.methods.getFundSettings().call() as Promise<
          Record<string, any>
        >,
        fundContract.methods.fundMetadata().call() as Promise<string>,
        fundContract.methods.feePerformancePeriod().call(),
        fundContract.methods.feeManagePeriod().call(),
      ]);

    if (!settings?.safe || !settings?.governor) {
      throw new Error(
        "Fund settings are not initialized yet — cannot build the activation proposal.",
      );
    }

    // Explicit field-by-field echo of the live struct. Do NOT spread the
    // web3 result (it carries positional keys), and do NOT take any of
    // these values from frontend state.
    const echoedSettings = {
      depositFee: settings.depositFee,
      withdrawFee: settings.withdrawFee,
      performanceFee: settings.performanceFee,
      managementFee: settings.managementFee,
      performaceHurdleRateBps: settings.performaceHurdleRateBps,
      baseToken: settings.baseToken,
      safe: settings.safe,
      isExternalGovTokenInUse: settings.isExternalGovTokenInUse,
      isWhitelistedDeposits: settings.isWhitelistedDeposits,
      // DANGER: these two MUST stay empty. They are XOR-toggle deltas, not
      // absolute sets — echoing the stored arrays would toggle every live
      // whitelist entry off.
      allowedDepositAddrs: [] as string[],
      allowedManagers: [] as string[],
      governanceToken: settings.governanceToken,
      fundAddress: settings.fundAddress,
      // The one intentional change: settings authority moves to the Safe.
      governor: settings.safe,
      fundName: settings.fundName,
      fundSymbol: settings.fundSymbol,
      feeCollectors: settings.feeCollectors,
    };

    targets.push(fundAddress);
    gasValues.push(0);
    calldatas.push(
      encodeFunctionCall(updateSettingsAbi, [
        echoedSettings,
        fundMetadata,
        // ABI order: _feePerformancePeriod then _feeManagePeriod.
        feePerformancePeriod,
        feeManagePeriod,
      ] as any),
    );
  }

  if (state.needsOwnershipTransfer && rolesModifierAddress) {
    // Only the current owner can transfer. The proposal executes as the
    // RethinkFundGovernor, so an owner that is neither the safe nor that
    // governor means this proposal could never execute — fail loudly
    // instead of creating a doomed proposal.
    if (
      executingGovernorAddress &&
      !eq(state.modifierOwner, executingGovernorAddress)
    ) {
      throw new Error(
        `Roles modifier owner is ${state.modifierOwner}, expected the ` +
          `governor ${executingGovernorAddress} — cannot propose ` +
          "transferOwnership.",
      );
    }
    targets.push(rolesModifierAddress);
    gasValues.push(0);
    calldatas.push(
      encodeFunctionCall(transferOwnershipAbi, [state.safe]),
    );
  }

  return { actions: { targets, gasValues, calldatas }, state };
};
