import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  DEFAULT_ROLE_KEY_V2,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";

/**
 * The calldata a role holder sends through the Roles modifier for the
 * settings and membership permissions (see vaultRoles.ts for what grants
 * them). Pure encoders with no store behind them, so the same bytes the
 * pages send can be replayed against the deployed contracts in tests.
 */

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const fundIface = new ethers.Interface(GovernableFund.abi as any);

/**
 * The live values updateSettings must echo. Read fresh from the fund right
 * before building calldata — never from cached frontend state — because the
 * Roles permission pins these values EXACTLY: an echo built from a stale
 * cache doesn't fail loudly, it fails as an opaque permission denial.
 */
export interface ILiveFundSettingsState {
  settings: Record<string, any>;
  fundMetadata: string;
  feePerformancePeriod: string;
  feeManagePeriod: string;
}

/**
 * updateSettings calldata for the curator-editable surfaces the Roles
 * permission leaves open: the depositor whitelist — its enforcement flag and
 * its addresses (XOR-toggle deltas) — the metadata JSON and the fee
 * destinations. Everything else echoes the live struct verbatim, with two deliberate exceptions the
 * permission demands:
 *
 * - governor is sent as the SAFE address (the permission pins it there; the
 *   fund's own governor check only passes once activation has run).
 * - allowedManagers is always [] (pinned empty — and, being an XOR delta,
 *   anything else would toggle live entries).
 *
 * Omitting isWhitelistedDeposits echoes the live flag, so a caller that only
 * edits addresses never races a concurrent flip.
 */
export const buildCuratorUpdateSettingsCalldata = (
  live: ILiveFundSettingsState,
  changes: {
    whitelistDeltas?: string[];
    isWhitelistedDeposits?: boolean;
    fundMetadata?: string;
    /** New fee destinations, in the struct's order; the live ones otherwise. */
    feeCollectors?: string[];
  },
): string => {
  const settings = live.settings;
  const echoedSettings = {
    depositFee: settings.depositFee,
    withdrawFee: settings.withdrawFee,
    performanceFee: settings.performanceFee,
    managementFee: settings.managementFee,
    performaceHurdleRateBps: settings.performaceHurdleRateBps,
    baseToken: settings.baseToken,
    safe: settings.safe,
    isExternalGovTokenInUse: settings.isExternalGovTokenInUse,
    isWhitelistedDeposits:
      changes.isWhitelistedDeposits ?? settings.isWhitelistedDeposits,
    // XOR-toggle deltas: ONLY the addresses whose state should flip.
    allowedDepositAddrs: changes.whitelistDeltas ?? [],
    allowedManagers: [] as string[],
    governanceToken: settings.governanceToken,
    fundAddress: settings.fundAddress,
    governor: settings.safe,
    fundName: settings.fundName,
    fundSymbol: settings.fundSymbol,
    feeCollectors: changes.feeCollectors ?? settings.feeCollectors,
  };
  return fundIface.encodeFunctionData("updateSettings", [
    Object.values(echoedSettings),
    changes.fundMetadata ?? live.fundMetadata,
    live.feePerformancePeriod,
    live.feeManagePeriod,
  ]);
};

/**
 * assignRoles calldata for one membership change, targeting the modifier.
 * Always one role per call: the membership permissions pin `roleKeys` to a
 * single-element array (see buildAssignRolesConditions).
 */
export const buildAssignRolesCalldata = (
  memberAddress: string,
  isMember: boolean,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
): string =>
  rolesIface.encodeFunctionData("assignRoles", [
    memberAddress,
    [toRoleKeyBytes32(roleKey)],
    [isMember],
  ]);
