import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import type { WalletBatchCall } from "~/services/eip5792";
import {
  RolesV2Operator,
  RolesV2ParameterType,
  TRANSFER_SELECTOR,
} from "~/composables/permissions/rolesV2Permissions";

/**
 * Sending test funds back from a vault's Safe before it is finalized.
 *
 * Until finalizeCreateFund the factory is the vault's authority over its
 * Roles modifier: submitPermissions forwards Roles admin calls on the
 * deployer's behalf. So the deployer can open a door, walk through it and
 * close it again in one EIP-5792 atomic batch:
 *
 *   1. factory.submitPermissions — assign the deployer a throwaway role whose
 *      only permission is `transfer(recipient, amount)` on the base token.
 *   2. modifier.execTransactionWithRole — the Safe makes that transfer.
 *   3. factory.submitPermissions — revoke the function and target and take
 *      the role back off the deployer.
 *
 * A dedicated role, not the curator's: the curator role may already scope
 * `transfer` on the base token (the "send funds to the fund contract"
 * permission pins the recipient to the vault). Scoping that same function
 * again would overwrite its condition, and revoking it afterwards would wipe
 * the vault's own permission. A role nobody else uses can be torn down
 * completely, leaving the modifier exactly as it was.
 *
 * Atomic or nothing: if any call reverts the batch reverts, so the role can
 * never be left granted. Wallets that cannot batch (Rabby, at the time of
 * writing) send the same three calls one by one instead — and a user can stop
 * after the first. `encodeReturnRoleProbe` / `isReturnRoleClosed` tell
 * whether the role is still assigned, so the step can offer the revoke on its
 * own and Finalize can refuse to run until it has: once the vault is
 * finalized the factory can no longer revoke anything, and the role would
 * outlive setup as a way to move that amount out of a live vault.
 *
 * Kept free of stores so the encoding is unit-testable.
 */

export type ReturnRolesVersion = "V1" | "V2";

/** Roles V2 key of the throwaway role. Never used by anything else. */
export const RETURN_ROLE_KEY_V2 = "testFundsReturn";
/**
 * Roles V1 id of the throwaway role. V1 numbers its roles; the factories hand
 * out 1, and the role editor counts up from there, so the top of the uint16
 * range stays clear.
 */
export const RETURN_ROLE_ID_V1 = 65535;

const FACTORY_INTERFACE = new ethers.Interface([
  "function submitPermissions(bytes[] calldatas)",
]);
const ERC20_INTERFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount)",
]);
const ROLES_V1 = new ethers.Interface((RolesFullV1 as any).abi);
const ROLES_V2 = new ethers.Interface((RolesFullV2 as any).abi);

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// Roles V1 parameter enums, as the app's other V1 permissions use them.
const V1_PARAM_TYPE_STATIC = 0;
const V1_COMPARISON_EQUAL_TO = 0;

export interface IReturnTestFundsParams {
  version: ReturnRolesVersion;
  factoryAddress: string;
  rolesModAddress: string;
  /** The vault's base token. */
  tokenAddress: string;
  /** The wallet sending the batch: it gets the role for the one call. */
  member: string;
  /** Where the funds go. */
  recipient: string;
  /** Base units. */
  amount: bigint;
}

/** transfer(recipient, amount), as the Safe sends it to the base token. */
export const encodeReturnTransfer = (recipient: string, amount: bigint) =>
  ERC20_INTERFACE.encodeFunctionData("transfer", [recipient, amount]);

const grantEntriesV2 = (p: IReturnTestFundsParams): string[] => {
  const key = ethers.encodeBytes32String(RETURN_ROLE_KEY_V2);
  // Calldata root, then both arguments pinned: the role can move this amount
  // to this address and nothing else, for the one call it exists for.
  const conditions = [
    [0, RolesV2ParameterType.Calldata, RolesV2Operator.Matches, "0x"],
    [
      0,
      RolesV2ParameterType.Static,
      RolesV2Operator.EqualTo,
      abiCoder.encode(["address"], [p.recipient]),
    ],
    [
      0,
      RolesV2ParameterType.Static,
      RolesV2Operator.EqualTo,
      abiCoder.encode(["uint256"], [p.amount]),
    ],
  ];
  return [
    ROLES_V2.encodeFunctionData("assignRoles", [p.member, [key], [true]]),
    ROLES_V2.encodeFunctionData("scopeTarget", [key, p.tokenAddress]),
    ROLES_V2.encodeFunctionData("scopeFunction", [
      key,
      p.tokenAddress,
      TRANSFER_SELECTOR,
      conditions,
      0, // ExecutionOptions.None
    ]),
  ];
};

const revokeEntriesV2 = (p: IReturnTestFundsParams): string[] => {
  const key = ethers.encodeBytes32String(RETURN_ROLE_KEY_V2);
  return [
    ROLES_V2.encodeFunctionData("revokeFunction", [
      key,
      p.tokenAddress,
      TRANSFER_SELECTOR,
    ]),
    ROLES_V2.encodeFunctionData("revokeTarget", [key, p.tokenAddress]),
    ROLES_V2.encodeFunctionData("assignRoles", [p.member, [key], [false]]),
  ];
};

const grantEntriesV1 = (p: IReturnTestFundsParams): string[] => {
  const role = RETURN_ROLE_ID_V1;
  return [
    ROLES_V1.encodeFunctionData("assignRoles", [p.member, [role], [true]]),
    ROLES_V1.encodeFunctionData("scopeTarget", [role, p.tokenAddress]),
    ROLES_V1.encodeFunctionData("scopeParameter", [
      role,
      p.tokenAddress,
      TRANSFER_SELECTOR,
      0,
      V1_PARAM_TYPE_STATIC,
      V1_COMPARISON_EQUAL_TO,
      abiCoder.encode(["address"], [p.recipient]),
    ]),
    ROLES_V1.encodeFunctionData("scopeParameter", [
      role,
      p.tokenAddress,
      TRANSFER_SELECTOR,
      1,
      V1_PARAM_TYPE_STATIC,
      V1_COMPARISON_EQUAL_TO,
      abiCoder.encode(["uint256"], [p.amount]),
    ]),
  ];
};

const revokeEntriesV1 = (p: IReturnTestFundsParams): string[] => {
  const role = RETURN_ROLE_ID_V1;
  return [
    ROLES_V1.encodeFunctionData("scopeRevokeFunction", [
      role,
      p.tokenAddress,
      TRANSFER_SELECTOR,
    ]),
    ROLES_V1.encodeFunctionData("revokeTarget", [role, p.tokenAddress]),
    ROLES_V1.encodeFunctionData("assignRoles", [p.member, [role], [false]]),
  ];
};

/** The transfer wrapped for the modifier, under the throwaway role. */
export const encodeReturnExecution = (p: IReturnTestFundsParams): string => {
  const transfer = encodeReturnTransfer(p.recipient, p.amount);
  return p.version === "V1"
    ? ROLES_V1.encodeFunctionData("execTransactionWithRole", [
      p.tokenAddress,
      0,
      transfer,
      0, // Operation.Call
      RETURN_ROLE_ID_V1,
      true, // shouldRevert — a failed transfer must take the batch with it
    ])
    : ROLES_V2.encodeFunctionData("execTransactionWithRole", [
      p.tokenAddress,
      0,
      transfer,
      0,
      ethers.encodeBytes32String(RETURN_ROLE_KEY_V2),
      true,
    ]);
};

/** The Roles admin calls that hand the deployer the throwaway role. */
export const buildReturnGrantEntries = (p: IReturnTestFundsParams): string[] =>
  p.version === "V1" ? grantEntriesV1(p) : grantEntriesV2(p);

/**
 * The Roles admin calls that take it back. Independent of the amount and the
 * recipient, so they also clean up a role an earlier return left behind.
 */
export const buildReturnRevokeEntries = (
  p: Pick<IReturnTestFundsParams, "version" | "tokenAddress" | "member">,
): string[] =>
  p.version === "V1"
    ? revokeEntriesV1(p as IReturnTestFundsParams)
    : revokeEntriesV2(p as IReturnTestFundsParams);

/** factory.submitPermissions(entries), as one call. */
export const encodeSubmitPermissions = (entries: string[]): string =>
  FACTORY_INTERFACE.encodeFunctionData("submitPermissions", [entries]);

/** Grant, transfer, revoke — the three calls of the return, in order. */
export const buildReturnTestFundsCalls = (
  p: IReturnTestFundsParams,
): WalletBatchCall[] => [
  {
    to: p.factoryAddress,
    data: encodeSubmitPermissions(buildReturnGrantEntries(p)),
  },
  {
    to: p.rolesModAddress,
    data: encodeReturnExecution(p),
  },
  {
    to: p.factoryAddress,
    data: encodeSubmitPermissions(buildReturnRevokeEntries(p)),
  },
];

// --- Is the throwaway role still assigned? ----------------------------------

/** Roles' NoMembership() — the same selector on V1 and V2. */
const NO_MEMBERSHIP_SELECTOR = "0xfd8e9f28";
/** Zodiac's NotAuthorized(address): the sender is not an enabled module (V2). */
const NOT_AUTHORIZED_SELECTOR = "0x4a0bfec1";
const ERROR_STRING_SELECTOR = "0x08c379a0";

/**
 * A dry-run of a zero transfer under the throwaway role, sent as the member.
 * It never matches a granted permission (those pin a positive amount), so it
 * only ever answers one question: does the member hold the role at all.
 */
export const encodeReturnRoleProbe = (
  p: Pick<IReturnTestFundsParams, "version" | "tokenAddress" | "member">,
): string =>
  encodeReturnExecution({
    ...(p as IReturnTestFundsParams),
    recipient: p.member,
    amount: 0n,
  });

/**
 * Reads the probe's outcome. Closed: the modifier refused the sender before
 * looking at the call — NoMembership, or a wallet that was never even enabled
 * as a module (NotAuthorized(address) on V2, "Module not authorized" on V1).
 * Anything else (a condition violation, or the call going through) means the
 * role is still assigned.
 */
export const isReturnRoleClosed = (
  reverted: boolean,
  returnData: string,
): boolean => {
  if (!reverted) return false;
  const selector = (returnData || "").slice(0, 10).toLowerCase();
  if (selector === NO_MEMBERSHIP_SELECTOR || selector === NOT_AUTHORIZED_SELECTOR) {
    return true;
  }
  if (selector === ERROR_STRING_SELECTOR) {
    try {
      const [message] = abiCoder.decode(["string"], "0x" + returnData.slice(10));
      return /module not authorized/i.test(String(message));
    } catch {
      return false;
    }
  }
  return false;
};
