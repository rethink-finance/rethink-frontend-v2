import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  DEFAULT_ROLE_KEY_V2,
  defaultScopedTargetPermissionRolesV2,
  getScopeTargetV2,
  rolesV2WriteFunctionAbiMap,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";

/**
 * Zodiac Roles v2 permission generation for the vault (GovernableFund) itself.
 *
 * Enum values below are taken from the VERIFIED source of the Roles v2.1
 * mastercopy the V1.5 factory's beacon points at
 * (0x9646fDAD06d3e24444381f44362a3B0eB343D337, identical bytecode on
 * HyperEVM / Base / Arbitrum, checked 2026-08-10), NOT from any SDK.
 *
 * compValue rule (v2.1 Packer._removeExtraneousOffsets): every EqualTo
 * compValue is plain `abi.encode(value)`; the contract itself strips the
 * leading offset word for non-inline types before hashing with keccak256.
 */
export enum RolesV2ParameterType {
  None = 0,
  Static = 1,
  Dynamic = 2,
  Tuple = 3,
  Array = 4,
  Calldata = 5,
  AbiEncoded = 6,
}

export enum RolesV2Operator {
  Pass = 0,
  And = 1,
  Or = 2,
  Nor = 3,
  Matches = 5,
  ArraySome = 6,
  ArrayEvery = 7,
  ArraySubset = 8,
  EqualToAvatar = 15,
  EqualTo = 16,
  GreaterThan = 17,
  LessThan = 18,
  SignedIntGreaterThan = 19,
  SignedIntLessThan = 20,
  Bitmask = 21,
  Custom = 22,
  WithinAllowance = 28,
  EtherWithinAllowance = 29,
  CallWithinAllowance = 30,
}

export enum RolesV2ExecutionOptions {
  None = 0,
  Send = 1,
  DelegateCall = 2,
  Both = 3,
}

// updateSettings((uint256,uint256,uint256,uint256,uint256,address,address,
//   bool,bool,address[],address[],address,address,address,string,string,
//   address[4]),string,uint256,uint256)
export const UPDATE_SETTINGS_SELECTOR = "0xf6c87ad5";
// assignRoles(address,bytes32[],bool[])
export const ASSIGN_ROLES_SELECTOR = "0x957ed2b3";
// transferOwnership(address) — must NEVER appear in a generated permission.
export const TRANSFER_OWNERSHIP_SELECTOR = "0xf2fde38b";
// The remaining selectors the prepopulated permissions grant. Named here so
// the code that grants them and the code that revokes them cannot drift.
// transfer(address,uint256) — on the base token
export const TRANSFER_SELECTOR = "0xa9059cbb";
// fundFlowsCall(bytes) — on the vault
export const FUND_FLOWS_CALL_SELECTOR = "0xec68ac8d";
// executeNAVUpdate(address) — on the vault
export const EXECUTE_NAV_UPDATE_SELECTOR = "0xa61f5814";

// ConditionFlat as the tuple array shape web3-eth-abi expects for
// (uint8 parent, uint8 paramType, uint8 operator, bytes compValue).
export type IRolesV2ConditionFlat = [number, number, number, string];

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/**
 * The values the updateSettings permission can freeze. Which of them it
 * actually does is decided by IUpdateSettingsOpenFields; governor is always
 * pinned to the Safe and allowedManagers to the empty array.
 */
export interface IUpdateSettingsPinnedValues {
  depositFee: bigint;
  withdrawFee: bigint;
  performanceFee: bigint;
  managementFee: bigint;
  performaceHurdleRateBps: bigint; // contract's typo, keep
  baseToken: string;
  safe: string;
  isExternalGovTokenInUse: boolean;
  /** Pinned only while the whitelist is closed to the role's holder. */
  isWhitelistedDeposits: boolean;
  governanceToken: string;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
  feeCollectors: [string, string, string, string];
  feePerformancePeriod: bigint;
  feeManagePeriod: bigint;
  /**
   * The raw metadata JSON string, exactly as stored. Only needed when the
   * permission keeps metadata closed (see IUpdateSettingsOpenFields).
   */
  fundMetadata?: string;
}

/**
 * Which parts of updateSettings the permission leaves open to its holder.
 * Everything not opened here is pinned to its current value.
 */
export interface IUpdateSettingsOpenFields {
  /** The metadata JSON: photo, description, strategist, links. */
  metadata: boolean;
  /** The depositor whitelist: its enforcement flag and its addresses. */
  whitelist: boolean;
  /**
   * The four fee collector addresses — where fees are paid, never how much:
   * the fee rates and both fee periods stay pinned regardless.
   */
  feeDestinations: boolean;
}

/** The policy vaults were created with before the admin role existed. */
export const DEFAULT_UPDATE_SETTINGS_OPEN_FIELDS: IUpdateSettingsOpenFields = {
  metadata: true,
  whitelist: true,
  feeDestinations: false,
};

const toBigInt = (v: any, field: string): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" || (typeof v === "string" && v !== "")) {
    return BigInt(v);
  }
  if (v === undefined || v === null || v === "") return 0n;
  throw new Error(`Cannot parse ${field} as uint256: ${v}`);
};

const toBool = (v: any, field: string): boolean => {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`Cannot parse ${field} as bool: ${v}`);
};

const toAddress = (v: any, field: string): string => {
  try {
    return ethers.getAddress(String(v));
  } catch {
    throw new Error(`Invalid address for ${field}: ${v}`);
  }
};

/**
 * Coerce the raw on-chain Settings struct (from the factory init cache or a
 * live getFundSettings() read — NEVER from cached/derived frontend state)
 * plus the two fee periods into pinned values.
 */
export const parseUpdateSettingsPinnedValues = (
  rawSettings: Record<string, any>,
  feePerformancePeriod: any,
  feeManagePeriod: any,
  fundMetadata?: string,
): IUpdateSettingsPinnedValues => {
  const feeCollectors = rawSettings.feeCollectors;
  if (!Array.isArray(feeCollectors) || feeCollectors.length !== 4) {
    throw new Error(
      `feeCollectors must be address[4], got: ${JSON.stringify(feeCollectors)}`,
    );
  }
  return {
    depositFee: toBigInt(rawSettings.depositFee, "depositFee"),
    withdrawFee: toBigInt(rawSettings.withdrawFee, "withdrawFee"),
    performanceFee: toBigInt(rawSettings.performanceFee, "performanceFee"),
    managementFee: toBigInt(rawSettings.managementFee, "managementFee"),
    performaceHurdleRateBps: toBigInt(
      rawSettings.performaceHurdleRateBps,
      "performaceHurdleRateBps",
    ),
    baseToken: toAddress(rawSettings.baseToken, "baseToken"),
    safe: toAddress(rawSettings.safe, "safe"),
    isExternalGovTokenInUse: toBool(
      rawSettings.isExternalGovTokenInUse,
      "isExternalGovTokenInUse",
    ),
    isWhitelistedDeposits: toBool(
      rawSettings.isWhitelistedDeposits,
      "isWhitelistedDeposits",
    ),
    governanceToken: toAddress(rawSettings.governanceToken, "governanceToken"),
    fundAddress: toAddress(rawSettings.fundAddress, "fundAddress"),
    fundName: String(rawSettings.fundName ?? ""),
    fundSymbol: String(rawSettings.fundSymbol ?? ""),
    feeCollectors: [
      toAddress(feeCollectors[0], "feeCollectors[0]"),
      toAddress(feeCollectors[1], "feeCollectors[1]"),
      toAddress(feeCollectors[2], "feeCollectors[2]"),
      toAddress(feeCollectors[3], "feeCollectors[3]"),
    ],
    feePerformancePeriod: toBigInt(feePerformancePeriod, "feePerformancePeriod"),
    feeManagePeriod: toBigInt(feeManagePeriod, "feeManagePeriod"),
    ...(fundMetadata === undefined ? {} : { fundMetadata }),
  };
};

// What the permission does with each Settings struct field, in the exact
// order the struct declares them. Three groups can be opened to the role's
// holder — the depositor whitelist (its addresses AND its enforcement flag,
// so deposits can be switched between permissionless and whitelist-only),
// the fee collector addresses, and (outside the struct) the metadata JSON.
// allowedManagers is always pinned to []; governor is always pinned to the
// SAFE (the post-activation value — see the activation proposal), and every
// other field is pinned to its current value. The fee rates are never
// opened: a holder who may move the fee destinations still cannot change a
// fee.
type FieldRule =
  | { kind: "pin" }
  | { kind: "wildcard" }
  | { kind: "pin-empty-array" }
  | { kind: "pin-to-safe" };

const settingsFieldRules = (
  open: IUpdateSettingsOpenFields,
): Record<string, FieldRule> => ({
  depositFee: { kind: "pin" },
  withdrawFee: { kind: "pin" },
  performanceFee: { kind: "pin" },
  managementFee: { kind: "pin" },
  performaceHurdleRateBps: { kind: "pin" },
  baseToken: { kind: "pin" },
  safe: { kind: "pin" },
  isExternalGovTokenInUse: { kind: "pin" },
  // Whitelist management covers both the enforcement flag and the address
  // list. Turning the flag off makes deposits permissionless, which is a
  // deliberate power of whoever holds this permission. Closed, the flag is
  // pinned and the address list must be sent empty — it is an XOR-toggle
  // delta, so an empty list changes nothing.
  isWhitelistedDeposits: open.whitelist ? { kind: "wildcard" } : { kind: "pin" },
  allowedDepositAddrs: open.whitelist
    ? { kind: "wildcard" }
    : { kind: "pin-empty-array" },
  allowedManagers: { kind: "pin-empty-array" },
  governanceToken: { kind: "pin" },
  fundAddress: { kind: "pin" },
  governor: { kind: "pin-to-safe" },
  fundName: { kind: "pin" },
  fundSymbol: { kind: "pin" },
  feeCollectors: open.feeDestinations ? { kind: "wildcard" } : { kind: "pin" },
});

// A tree node prior to BFS flattening.
interface IConditionNode {
  paramType: RolesV2ParameterType;
  operator: RolesV2Operator;
  compValue: string;
  children: IConditionNode[];
}

/**
 * Describe an ABI type as a Roles v2 type-tree node with Pass operators.
 * Fixed-size arrays (e.g. address[4]) have static tuple layout in calldata,
 * and Roles v2 has no fixed-array type, so they map to Tuple with N
 * identical children.
 */
const typeToPassNode = (param: ethers.ParamType): IConditionNode => {
  if (param.baseType === "tuple") {
    return {
      paramType: RolesV2ParameterType.Tuple,
      operator: RolesV2Operator.Pass,
      compValue: "0x",
      children: (param.components ?? []).map(typeToPassNode),
    };
  }
  if (param.baseType === "array") {
    const child = typeToPassNode(param.arrayChildren!);
    if (param.arrayLength === -1) {
      // Dynamic array: single template child describes the element type.
      return {
        paramType: RolesV2ParameterType.Array,
        operator: RolesV2Operator.Pass,
        compValue: "0x",
        children: [child],
      };
    }
    return {
      paramType: RolesV2ParameterType.Tuple,
      operator: RolesV2Operator.Pass,
      compValue: "0x",
      children: Array.from({ length: param.arrayLength! }, () =>
        typeToPassNode(param.arrayChildren!),
      ),
    };
  }
  if (param.baseType === "string" || param.baseType === "bytes") {
    return {
      paramType: RolesV2ParameterType.Dynamic,
      operator: RolesV2Operator.Pass,
      compValue: "0x",
      children: [],
    };
  }
  return {
    paramType: RolesV2ParameterType.Static,
    operator: RolesV2Operator.Pass,
    compValue: "0x",
    children: [],
  };
};

/**
 * Turn a Pass-shaped node into an EqualTo pin. compValue is plain
 * abi.encode(value) — the v2.1 contract strips the extraneous offset word
 * for non-inline types itself (Packer._removeExtraneousOffsets).
 * Structural children are kept (Integrity requires Tuple/Array nodes to
 * describe their layout) but stay Pass.
 */
const pinNode = (
  node: IConditionNode,
  param: ethers.ParamType,
  value: any,
): IConditionNode => ({
  ...node,
  operator: RolesV2Operator.EqualTo,
  compValue: abiCoder.encode([param], [value]),
});

const metadataNode = (
  param: ethers.ParamType,
  pinned: IUpdateSettingsPinnedValues,
  open: IUpdateSettingsOpenFields,
): IConditionNode => {
  const node = typeToPassNode(param);
  if (open.metadata) return node;
  if (pinned.fundMetadata === undefined) {
    throw new Error(
      "Cannot keep vault metadata closed without the stored metadata to pin it to.",
    );
  }
  return pinNode(node, param, pinned.fundMetadata);
};

const getUpdateSettingsFragment = (): ethers.FunctionFragment => {
  const iface = new ethers.Interface(GovernableFund.abi as any);
  const fragment = iface.getFunction("updateSettings");
  if (!fragment || fragment.selector !== UPDATE_SETTINGS_SELECTOR) {
    throw new Error(
      `updateSettings fragment mismatch: ${fragment?.selector} != ${UPDATE_SETTINGS_SELECTOR}`,
    );
  }
  return fragment;
};

/**
 * Build the ConditionFlat[] for updateSettings, derived from the ABI
 * fragment. Resulting policy: the holder can change ONLY what `open` names
 * — the depositor whitelist (enforcement flag and address deltas), the
 * metadata JSON, the fee collector addresses. Fee rates, hurdle, name,
 * symbol, base token, governance wiring and both fee periods are always
 * frozen; governor must be echoed as the SAFE address.
 */
export const buildUpdateSettingsConditions = (
  pinned: IUpdateSettingsPinnedValues,
  open: IUpdateSettingsOpenFields = DEFAULT_UPDATE_SETTINGS_OPEN_FIELDS,
): IRolesV2ConditionFlat[] => {
  const fragment = getUpdateSettingsFragment();
  const [settingsParam, metadataParam, perfPeriodParam, managePeriodParam] =
    fragment.inputs;

  // Guard against silent ABI drift: the rules table must cover the struct
  // exactly, in order.
  const rules = settingsFieldRules(open);
  const componentNames = (settingsParam.components ?? []).map((c) => c.name);
  const ruleNames = Object.keys(rules);
  if (JSON.stringify(componentNames) !== JSON.stringify(ruleNames)) {
    throw new Error(
      `updateSettings Settings struct fields changed: ${componentNames.join(",")}`,
    );
  }

  const settingsChildren = (settingsParam.components ?? []).map((component) => {
    const node = typeToPassNode(component);
    const rule = rules[component.name];
    switch (rule.kind) {
      case "wildcard":
        return node;
      case "pin-empty-array":
        return pinNode(node, component, []);
      case "pin-to-safe":
        return pinNode(node, component, pinned.safe);
      case "pin":
        return pinNode(
          node,
          component,
          pinned[component.name as keyof IUpdateSettingsPinnedValues],
        );
      default:
        throw new Error(`Unhandled field rule for ${component.name}`);
    }
  });

  const root: IConditionNode = {
    paramType: RolesV2ParameterType.Calldata,
    operator: RolesV2Operator.Matches,
    compValue: "0x",
    children: [
      {
        paramType: RolesV2ParameterType.Tuple,
        operator: RolesV2Operator.Matches,
        compValue: "0x",
        children: settingsChildren,
      },
      // _fundMetadata (photo, description, strategist, links, settlement
      // period, min liquid asset share, custom fields): open, or pinned to
      // the stored string so every call has to echo it unchanged.
      metadataNode(metadataParam, pinned, open),
      pinNode(
        typeToPassNode(perfPeriodParam),
        perfPeriodParam,
        pinned.feePerformancePeriod,
      ),
      pinNode(
        typeToPassNode(managePeriodParam),
        managePeriodParam,
        pinned.feeManagePeriod,
      ),
    ],
  };

  return flattenConditionTree(root);
};

/**
 * Breadth-first flattening with parent indices, as Integrity.enforce
 * requires (parents must be non-decreasing; node 0 is its own parent).
 */
const flattenConditionTree = (
  root: IConditionNode,
): IRolesV2ConditionFlat[] => {
  const result: IRolesV2ConditionFlat[] = [];
  const queue: { node: IConditionNode; parent: number }[] = [
    { node: root, parent: 0 },
  ];
  while (queue.length) {
    const { node, parent } = queue.shift()!;
    const index =
      result.push([parent, node.paramType, node.operator, node.compValue]) - 1;
    for (const child of node.children) {
      queue.push({ node: child, parent: index });
    }
  }
  if (result.length > 256) {
    // ConditionFlat.parent is uint8.
    throw new Error(`Condition tree too large: ${result.length} nodes`);
  }
  return result;
};

/**
 * "Update vault settings": scopeTarget on the fund + scopeFunction for
 * updateSettings with the pinned condition tree, opened only where `open`
 * says. ExecutionOptions.None — no ETH send, no delegatecall.
 */
export const generateUpdateSettingsPermissionRolesV2 = (
  fundAddress: string,
  pinned: IUpdateSettingsPinnedValues,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  open: IUpdateSettingsOpenFields = DEFAULT_UPDATE_SETTINGS_OPEN_FIELDS,
): string[] => {
  const conditions = buildUpdateSettingsConditions(pinned, open);
  const encodedScopeFunction = encodeFunctionCall(
    rolesV2WriteFunctionAbiMap.scopeFunction,
    [
      toRoleKeyBytes32(roleKey),
      fundAddress,
      UPDATE_SETTINGS_SELECTOR,
      conditions as any,
      RolesV2ExecutionOptions.None,
    ],
  );
  return [getScopeTargetV2(roleKey, fundAddress), encodedScopeFunction];
};

// assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)
const ASSIGN_ROLES_PARAMS = [
  ethers.ParamType.from("address module"),
  ethers.ParamType.from("bytes32[] roleKeys"),
  ethers.ParamType.from("bool[] memberOf"),
];

export interface IAssignRolesScope {
  /**
   * The roles whose membership the holder may change (labels or bytes32).
   * Each call must name exactly ONE of them: `roleKeys` is pinned to a
   * single-element array per allowed role, so a call can never smuggle a
   * second, unlisted role in beside an allowed one.
   */
  roleKeys: string[];
  /**
   * Pin the direction: `false` allows removals only, `true` additions only.
   * Left out, the holder may both add and remove.
   */
  memberOf?: boolean;
}

/**
 * The ConditionFlat[] for assignRoles under `scope`.
 *
 * The member address is deliberately left open, and it cannot be otherwise:
 * a Roles v2 condition sees the calldata, never the caller, so "only your
 * own address" is not expressible. A removals-only scope therefore lets a
 * holder remove ANY member of the listed roles — itself included, which is
 * what a self-revoke needs — but never add one.
 */
export const buildAssignRolesConditions = (
  scope: IAssignRolesScope,
): IRolesV2ConditionFlat[] => {
  if (!scope.roleKeys.length) {
    throw new Error("An assignRoles permission needs at least one role.");
  }
  const [moduleParam, roleKeysParam, memberOfParam] = ASSIGN_ROLES_PARAMS;

  const roleKeyNodes = scope.roleKeys.map((roleKey) =>
    pinNode(typeToPassNode(roleKeysParam), roleKeysParam, [
      toRoleKeyBytes32(roleKey),
    ]),
  );
  const roleKeysNode: IConditionNode =
    roleKeyNodes.length === 1
      ? roleKeyNodes[0]
      : {
        paramType: RolesV2ParameterType.None,
        operator: RolesV2Operator.Or,
        compValue: "0x",
        children: roleKeyNodes,
      };

  const memberOfNode =
    scope.memberOf === undefined
      ? typeToPassNode(memberOfParam)
      : pinNode(typeToPassNode(memberOfParam), memberOfParam, [scope.memberOf]);

  return flattenConditionTree({
    paramType: RolesV2ParameterType.Calldata,
    operator: RolesV2Operator.Matches,
    compValue: "0x",
    children: [typeToPassNode(moduleParam), roleKeysNode, memberOfNode],
  });
};

/**
 * Membership admin on the Roles modifier itself, for the roles `scope`
 * names and nothing else: scopeTarget on the modifier + scopeFunction for
 * assignRoles(address,bytes32[],bool[]). Membership admin and permission
 * admin are separate selectors on Roles v2, so the scope/allow/revoke
 * functions, enableModule, disableModule, setDefaultRole and
 * transferOwnership stay denied because they are never scoped for the role.
 *
 * The role keys are always pinned. A wildcarded assignRoles would let its
 * holder assign members to ANY role key on the modifier — including a more
 * privileged one — which is why this never emits allowFunction.
 */
export const generateAssignRolesPermissionRolesV2 = (
  rolesModifierAddress: string,
  holderRoleKey: string,
  scope: IAssignRolesScope,
): string[] => {
  const encodedScopeFunction = encodeFunctionCall(
    rolesV2WriteFunctionAbiMap.scopeFunction,
    [
      toRoleKeyBytes32(holderRoleKey),
      rolesModifierAddress,
      ASSIGN_ROLES_SELECTOR,
      buildAssignRolesConditions(scope) as any,
      RolesV2ExecutionOptions.None,
    ],
  );
  return [
    getScopeTargetV2(holderRoleKey, rolesModifierAddress),
    encodedScopeFunction,
  ];
};

// mintPoolPerformanceFeeHWM(address) — the call fundFlowsCall wraps to
// collect fees.
const MINT_PERFORMANCE_FEE_SELECTOR = "0xa52eb8be";

/**
 * "Collect fee": fundFlowsCall(bytes) on the vault, with the payload pinned
 * to mintPoolPerformanceFeeHWM(<the chain's performance fee contract>).
 */
export const generateCollectFeesPermissionRolesV2 = (
  fundAddress: string,
  poolPerformanceFeeAddress: string,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
): string[] => {
  const innerBytes =
    MINT_PERFORMANCE_FEE_SELECTOR +
    abiCoder.encode(["address"], [poolPerformanceFeeAddress]).slice(2);
  const conditions: IRolesV2ConditionFlat[] = [
    [0, RolesV2ParameterType.Calldata, RolesV2Operator.Matches, "0x"],
    [
      0,
      RolesV2ParameterType.Dynamic,
      RolesV2Operator.EqualTo,
      abiCoder.encode(["bytes"], [innerBytes]),
    ],
  ];
  const encodedScopeFunction = encodeFunctionCall(
    rolesV2WriteFunctionAbiMap.scopeFunction,
    [
      toRoleKeyBytes32(roleKey),
      fundAddress,
      FUND_FLOWS_CALL_SELECTOR,
      conditions as any,
      RolesV2ExecutionOptions.None,
    ],
  );
  return [encodedScopeFunction, getScopeTargetV2(roleKey, fundAddress)];
};

/**
 * "Send funds to admin contract & settle flows": transfer(address,uint256)
 * on the base token, recipient pinned to the vault.
 */
export const generateSendFundsPermissionRolesV2 = (
  baseTokenAddress: string,
  fundAddress: string,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
): string[] => [
  getScopeTargetV2(roleKey, baseTokenAddress),
  defaultScopedTargetPermissionRolesV2(
    roleKey,
    baseTokenAddress,
    TRANSFER_SELECTOR,
    fundAddress,
  ),
];
