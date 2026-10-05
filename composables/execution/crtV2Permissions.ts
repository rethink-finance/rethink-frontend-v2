import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  RolesV2ExecutionOptions,
  RolesV2Operator,
  RolesV2ParameterType,
  type IRolesV2ConditionFlat,
} from "~/composables/permissions/rolesV2Permissions";
import {
  ARBITRUM_CHAIN_ID,
  CRT_V2_ADDR,
  CRT_V2_ROLE_KEYS,
  HYPERCORE_ACTION,
  SEND_ASSET_PINNED_BYTES,
  encodeSendUsdcToEvm,
  hypercoreHeader,
  type CrtV2Role,
} from "~/composables/execution/crtV2Vault";

/**
 * The raw Roles v2 permissions the CarrotFunding Vault's two roles need on
 * top of what the create flow's Permissions step stores for them. Each entry
 * is one call on the modifier (scopeTarget / scopeFunction), encoded exactly
 * as the step's "Raw code" input takes it, so the output of
 * crtV2RawPermissionsJson can be pasted there as it is and goes out in the
 * same submitPermissions batch as the switches.
 *
 * What the step already stores, verified on the live modifier on 2026-10-05
 * and NOT repeated here: the admin's updateSettings (whitelist, metadata and
 * fee destinations open, everything else pinned to the factory's init cache)
 * and assignRoles over the two roles; the executor's executeNAVUpdate,
 * fundFlowsCall(mint performance fee), USDC.transfer to the vault and
 * self-revoke.
 *
 * ADMIN (the Carrot 2-of-4 Safe) gains:
 *  - payouts: USDC.transfer to the payout wallet, any amount;
 *  - payouts to Arbitrum: USDC.approve to the Across SpokePool and
 *    depositV3Now with depositor, recipient, both tokens, destination chain
 *    and message pinned, amounts and fill window open;
 *  - HyperCore API wallets: CoreWriter.sendRawAction limited to addApiWallet,
 *    with the agent address and the name (which carries the expiry) open —
 *    a trader can be rotated or re-registered for 14 to 180 days without a
 *    new proposal.
 *
 * EXECUTOR (the manager key) gains:
 *  - USDC.approve to the CoreDepositWallet, Felix and HyperLend only;
 *  - EVM → Core: CoreDepositWallet.depositFor to the Safe's own account;
 *  - Core → EVM: sendAsset from Core spot to the Safe's EVM balance, any
 *    amount (every field but the amount is pinned byte by byte);
 *  - spot ↔ perp: usdClassTransfer, any amount, either direction;
 *  - Felix deposit / withdraw / redeem and HyperLend supply / withdraw, every
 *    receiver pinned to the Safe.
 *
 * Roles v2 cannot see the caller, so none of this says WHO: whoever holds the
 * role may do all of it. The admin's set moves money only to the payout
 * wallet; the executor's moves it only between the Safe's own venues.
 */

const coder = ethers.AbiCoder.defaultAbiCoder();
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);

export const CRT_V2_IFACES = {
  erc20: new ethers.Interface([
    "function approve(address spender, uint256 amount)",
    "function transfer(address to, uint256 amount)",
  ]),
  spoke: new ethers.Interface([
    "function depositV3Now(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 fillDeadlineOffset, uint32 exclusivityPeriod, bytes message)",
  ]),
  writer: new ethers.Interface(["function sendRawAction(bytes payload)"]),
  cdw: new ethers.Interface(["function depositFor(address receiver, uint256 amount, uint32 dex)"]),
  felix: new ethers.Interface([
    "function deposit(uint256 assets, address receiver) returns (uint256)",
    "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  ]),
  pool: new ethers.Interface([
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
    "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  ]),
};

const selector = (iface: ethers.Interface, name: string): string => {
  const fragment = iface.getFunction(name);
  if (!fragment) throw new Error(`No function ${name}`);
  return fragment.selector;
};

export const CRT_V2_SELECTORS = {
  approve: selector(CRT_V2_IFACES.erc20, "approve"),
  transfer: selector(CRT_V2_IFACES.erc20, "transfer"),
  depositV3Now: selector(CRT_V2_IFACES.spoke, "depositV3Now"),
  sendRawAction: selector(CRT_V2_IFACES.writer, "sendRawAction"),
  depositFor: selector(CRT_V2_IFACES.cdw, "depositFor"),
  felixDeposit: selector(CRT_V2_IFACES.felix, "deposit"),
  felixWithdraw: selector(CRT_V2_IFACES.felix, "withdraw"),
  felixRedeem: selector(CRT_V2_IFACES.felix, "redeem"),
  poolSupply: selector(CRT_V2_IFACES.pool, "supply"),
  poolWithdraw: selector(CRT_V2_IFACES.pool, "withdraw"),
};

// ─── Condition trees ─────────────────────────────────────────────────────────

interface IConditionNode {
  paramType: RolesV2ParameterType;
  operator: RolesV2Operator;
  compValue: string;
  children: IConditionNode[];
}

const leaf = (
  paramType: RolesV2ParameterType,
  operator: RolesV2Operator,
  compValue = "0x",
): IConditionNode => ({ paramType, operator, compValue, children: [] });

/** A parameter the holder may set freely. */
const open = (paramType = RolesV2ParameterType.Static): IConditionNode =>
  leaf(paramType, RolesV2Operator.Pass);

/**
 * A pinned value. compValue is plain abi.encode(value): the v2.1 modifier
 * strips the leading offset word of a dynamic value itself before hashing
 * (Packer._removeExtraneousOffsets) — the same rule rolesV2Permissions.ts
 * follows for the vault's own permissions.
 */
const equalTo = (type: string, value: unknown): IConditionNode =>
  leaf(
    type === "bytes" || type === "string"
      ? RolesV2ParameterType.Dynamic
      : RolesV2ParameterType.Static,
    RolesV2Operator.EqualTo,
    coder.encode([type], [value]),
  );

const logical = (
  operator: RolesV2Operator.And | RolesV2Operator.Or,
  children: IConditionNode[],
): IConditionNode => ({
  paramType: RolesV2ParameterType.None,
  operator,
  compValue: "0x",
  children,
});

/** The root: the call's parameters, in ABI order, one node each. */
const calldataMatches = (children: IConditionNode[]): IConditionNode => ({
  paramType: RolesV2ParameterType.Calldata,
  operator: RolesV2Operator.Matches,
  compValue: "0x",
  children,
});

/**
 * A Bitmask on the bytes of a `bytes` parameter: compValue is 2 bytes of
 * shift, then 15 bytes of mask and 15 bytes of expected value, and the
 * modifier compares (payload[shift : shift + 15] & mask) with expected. For
 * a dynamic parameter the shift counts from the first byte of content, not
 * from its length word.
 */
export const bitmaskCompValue = (
  shift: number,
  mask: Uint8Array,
  expected: Uint8Array,
): string => {
  if (shift < 0 || shift > 0xffff) throw new Error(`Bitmask shift out of range: ${shift}`);
  if (mask.length > 15 || expected.length > 15) {
    throw new Error("A Bitmask window covers at most 15 bytes");
  }
  return ethers.hexlify(
    ethers.concat([
      ethers.toBeHex(shift, 2),
      ethers.zeroPadBytes(mask, 15),
      ethers.zeroPadBytes(expected, 15),
    ]),
  );
};

const bitmask = (shift: number, mask: Uint8Array, expected: Uint8Array): IConditionNode =>
  leaf(RolesV2ParameterType.Dynamic, RolesV2Operator.Bitmask, bitmaskCompValue(shift, mask, expected));

/** The 4-byte HyperCore header (version + action id) at the start of a payload. */
const hypercoreActionIs = (actionId: number): IConditionNode =>
  bitmask(0, new Uint8Array([0xff, 0xff, 0xff, 0xff]), ethers.getBytes(hypercoreHeader(actionId)));

/**
 * Pin the first `pinnedLength` bytes of a payload to those of `reference`,
 * as a run of 15-byte Bitmask windows; the bytes after that stay open. The
 * last window's mask stops at the pinned length, so a byte that belongs to
 * an open field is never compared.
 */
export const bitmaskPrefixWindows = (
  reference: string,
  pinnedLength: number,
): IConditionNode[] => {
  const bytes = ethers.getBytes(reference);
  if (pinnedLength > bytes.length) {
    throw new Error(`Reference payload is shorter than the ${pinnedLength} pinned bytes`);
  }
  const windows: IConditionNode[] = [];
  for (let shift = 0; shift < pinnedLength; shift += 15) {
    const size = Math.min(15, pinnedLength - shift);
    const mask = new Uint8Array(15).fill(0xff, 0, size);
    const expected = bytes.slice(shift, shift + size);
    windows.push(bitmask(shift, mask, expected));
  }
  return windows;
};

/** Breadth-first, parents non-decreasing, node 0 its own parent: Integrity.enforce's order. */
export const flattenConditionTree = (root: IConditionNode): IRolesV2ConditionFlat[] => {
  const result: IRolesV2ConditionFlat[] = [];
  const queue: { node: IConditionNode; parent: number }[] = [{ node: root, parent: 0 }];
  while (queue.length) {
    const { node, parent } = queue.shift()!;
    const index = result.push([parent, node.paramType, node.operator, node.compValue]) - 1;
    for (const child of node.children) queue.push({ node: child, parent: index });
  }
  if (result.length > 256) throw new Error(`Condition tree too large: ${result.length} nodes`);
  return result;
};

// ─── Encoding the modifier calls ─────────────────────────────────────────────

export interface ICrtV2PermissionEntry {
  /** The role the call grants to. */
  role: CrtV2Role;
  /** What the entry lets the role do, for review. */
  label: string;
  /** The Roles modifier calldata, as the Raw code input takes it. */
  data: string;
}

const scopeTarget = (role: CrtV2Role, target: string, label: string): ICrtV2PermissionEntry => ({
  role,
  label,
  data: rolesIface.encodeFunctionData("scopeTarget", [CRT_V2_ROLE_KEYS[role], target]),
});

const scopeFunction = (
  role: CrtV2Role,
  target: string,
  functionSelector: string,
  root: IConditionNode,
  label: string,
): ICrtV2PermissionEntry => ({
  role,
  label,
  data: rolesIface.encodeFunctionData("scopeFunction", [
    CRT_V2_ROLE_KEYS[role],
    target,
    functionSelector,
    flattenConditionTree(root),
    RolesV2ExecutionOptions.None,
  ]),
});

const A = CRT_V2_ADDR;

/** The Core → EVM payload with a zero amount: everything pinned is read off it. */
export const SEND_ASSET_TO_EVM_REFERENCE = encodeSendUsdcToEvm(0n);

/** The whole-payload condition for the executor's two CoreWriter actions. */
export const executorCoreWriterCondition = (): IConditionNode =>
  calldataMatches([
    logical(RolesV2Operator.Or, [
      // usdClassTransfer: spot ↔ perp inside the Safe's own account. Amount
      // and direction open: only the action id is pinned.
      hypercoreActionIs(HYPERCORE_ACTION.usdClassTransfer),
      // sendAsset: Core spot → the Safe's EVM balance. Header, destination
      // (the USDC system address), subAccount (none), both dexes (spot) and
      // token (USDC) pinned byte by byte; the amount word is open.
      logical(
        RolesV2Operator.And,
        bitmaskPrefixWindows(SEND_ASSET_TO_EVM_REFERENCE, SEND_ASSET_PINNED_BYTES),
      ),
    ]),
  ]);

/** The admin's CoreWriter condition: addApiWallet, agent and name open. */
export const adminCoreWriterCondition = (): IConditionNode =>
  calldataMatches([hypercoreActionIs(HYPERCORE_ACTION.addApiWallet)]);

/** The Across deposit as the admin may make it: only the amounts, relayer and fill window are open. */
export const adminAcrossDepositCondition = (): IConditionNode =>
  calldataMatches([
    equalTo("address", A.safe), // depositor: refunds come back to the Safe
    equalTo("address", A.payout), // recipient
    equalTo("address", A.usdc), // inputToken
    equalTo("address", A.arbUsdc), // outputToken
    open(), // inputAmount
    open(), // outputAmount
    equalTo("uint256", ARBITRUM_CHAIN_ID), // destinationChainId
    open(), // exclusiveRelayer
    open(), // fillDeadlineOffset
    open(), // exclusivityPeriod
    equalTo("bytes", "0x"), // message: a plain transfer, no call on arrival
  ]);

export const buildCrtV2AdminRawPermissions = (): ICrtV2PermissionEntry[] => [
  scopeTarget("admin", A.usdc, "USDC: scoped target"),
  scopeFunction(
    "admin",
    A.usdc,
    CRT_V2_SELECTORS.transfer,
    calldataMatches([equalTo("address", A.payout), open()]),
    "USDC.transfer: to the payout wallet only, any amount",
  ),
  scopeFunction(
    "admin",
    A.usdc,
    CRT_V2_SELECTORS.approve,
    calldataMatches([equalTo("address", A.spokePool), open()]),
    "USDC.approve: the Across SpokePool only, any amount",
  ),
  scopeTarget("admin", A.spokePool, "Across SpokePool: scoped target"),
  scopeFunction(
    "admin",
    A.spokePool,
    CRT_V2_SELECTORS.depositV3Now,
    adminAcrossDepositCondition(),
    "Across depositV3Now: Safe → payout wallet on Arbitrum, USDC → USDC, amounts and fill window open",
  ),
  scopeTarget("admin", A.coreWriter, "CoreWriter: scoped target"),
  scopeFunction(
    "admin",
    A.coreWriter,
    CRT_V2_SELECTORS.sendRawAction,
    adminCoreWriterCondition(),
    "CoreWriter.sendRawAction: addApiWallet only — any agent address, any name and expiry (zero address removes)",
  ),
];

export const buildCrtV2ExecutorRawPermissions = (): ICrtV2PermissionEntry[] => [
  scopeTarget("executor", A.usdc, "USDC: scoped target"),
  scopeFunction(
    "executor",
    A.usdc,
    CRT_V2_SELECTORS.approve,
    calldataMatches([
      logical(RolesV2Operator.Or, [
        equalTo("address", A.cdw),
        equalTo("address", A.felix),
        equalTo("address", A.pool),
      ]),
      open(),
    ]),
    "USDC.approve: CoreDepositWallet, Felix or HyperLend only, any amount",
  ),
  scopeTarget("executor", A.cdw, "CoreDepositWallet: scoped target"),
  scopeFunction(
    "executor",
    A.cdw,
    CRT_V2_SELECTORS.depositFor,
    calldataMatches([equalTo("address", A.safe), open(), equalTo("uint32", 0)]),
    "CoreDepositWallet.depositFor: EVM → the Safe's own HyperCore account, any amount",
  ),
  scopeTarget("executor", A.coreWriter, "CoreWriter: scoped target"),
  scopeFunction(
    "executor",
    A.coreWriter,
    CRT_V2_SELECTORS.sendRawAction,
    executorCoreWriterCondition(),
    "CoreWriter.sendRawAction: usdClassTransfer (spot ↔ perp, any amount) or sendAsset USDC Core spot → the Safe's EVM balance (any amount)",
  ),
  scopeTarget("executor", A.felix, "Felix feUSDC: scoped target"),
  scopeFunction(
    "executor",
    A.felix,
    CRT_V2_SELECTORS.felixDeposit,
    calldataMatches([open(), equalTo("address", A.safe)]),
    "Felix.deposit: any amount, shares to the Safe",
  ),
  scopeFunction(
    "executor",
    A.felix,
    CRT_V2_SELECTORS.felixWithdraw,
    calldataMatches([open(), equalTo("address", A.safe), equalTo("address", A.safe)]),
    "Felix.withdraw: any amount, from and to the Safe",
  ),
  scopeFunction(
    "executor",
    A.felix,
    CRT_V2_SELECTORS.felixRedeem,
    calldataMatches([open(), equalTo("address", A.safe), equalTo("address", A.safe)]),
    "Felix.redeem: any share amount, from and to the Safe",
  ),
  scopeTarget("executor", A.pool, "HyperLend pool: scoped target"),
  scopeFunction(
    "executor",
    A.pool,
    CRT_V2_SELECTORS.poolSupply,
    calldataMatches([equalTo("address", A.usdc), open(), equalTo("address", A.safe), open()]),
    "HyperLend.supply: USDC, any amount, on behalf of the Safe",
  ),
  scopeFunction(
    "executor",
    A.pool,
    CRT_V2_SELECTORS.poolWithdraw,
    calldataMatches([equalTo("address", A.usdc), open(), equalTo("address", A.safe)]),
    "HyperLend.withdraw: USDC, any amount (uint256.max for all), to the Safe",
  ),
];

/** The JSON array the Permissions step's Raw code input accepts. */
export const crtV2RawPermissionsJson = (entries: ICrtV2PermissionEntry[]): string =>
  JSON.stringify(entries.map((entry) => entry.data), null, 2);

/** Every function scope an entry list grants, for the console's readiness probes and the tests. */
export const crtV2ScopedFunctions = (
  entries: ICrtV2PermissionEntry[],
): { role: CrtV2Role; target: string; selector: string; conditions: number }[] =>
  entries.flatMap((entry) => {
    const parsed = rolesIface.parseTransaction({ data: entry.data });
    if (!parsed || parsed.name !== "scopeFunction") return [];
    return [{
      role: entry.role,
      target: String(parsed.args[1]),
      selector: String(parsed.args[2]),
      conditions: (parsed.args[3] as unknown[]).length,
    }];
  });
