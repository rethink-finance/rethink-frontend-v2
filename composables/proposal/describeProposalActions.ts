import { ethers } from "ethers";
import { eth } from "web3";
import type { AbiFunctionFragment, AbiParameter } from "web3";
import type { JsonFragment } from "ethers";
import { cleanComplexWeb3Data } from "~/composables/utils";
import { fromBpsToPercentage } from "~/composables/formatters";
import { resolveKnownFunction } from "~/composables/proposal/decodeProposalCallData";
import {
  RolesV2Operator,
  RolesV2ParameterType,
} from "~/composables/permissions/rolesV2Permissions";
import type IFund from "~/types/fund";
import { flattenAbiFunctionInputs } from "~/composables/zodiac-roles/flattenAbiFunctionInputs";

/**
 * Turns the calls a governance proposal makes into data a page can explain in
 * plain language: which function on which contract with which arguments, what
 * a Roles entry grants or takes away, which vault settings actually change.
 *
 * Everything here is pure — addresses come back as addresses, and the caller
 * decides how to label them — so it can be unit tested without a store.
 */

export const MULTISEND_SELECTOR = "0x8d80ff0a";
// fundFlowsCall(bytes) — the vault forwards the bytes to its flows delegate.
export const FUND_FLOWS_CALL_SELECTOR = "0xec68ac8d";

/**
 * Signatures the vendored ABIs do not carry: the flows delegate the vault
 * reaches through fundFlowsCall, and the wider ERC20 / proxy surface a call
 * inside a Safe batch may hit. Mirrors the backend monitor's list.
 */
export const EXTRA_SIGNATURES = [
  "function mintToMany(uint256[] amounts, address[] recipients)",
  "function sweepTokens()",
  "function requestDeposit(uint256 amount)",
  "function deposit()",
  "function depositAndDelegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  "function revokeDepositWithrawal(bool isDeposit)",
  "function requestWithdraw(uint256 amount)",
  "function withdraw()",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function burnFrom(address account, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
  "function increaseAllowance(address spender, uint256 addedValue)",
  "function decreaseAllowance(address spender, uint256 subtractedValue)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function delegate(address delegatee)",
  "function upgradeTo(address newImplementation)",
  "function upgradeToAndCall(address newImplementation, bytes data)",
];

/* ---- Generic call decoding --------------------------------------------- */

/**
 * A function the way a reader wants to see it: its name and its parameter
 * names, `transfer(to, amount)`, falling back to the type where the ABI
 * left a parameter unnamed.
 */
export const formatFunctionLabel = (
  name: string,
  inputs: { name?: string; type?: string }[],
): string =>
  `${name}(${inputs.map((input) => input.name || shortType(input.type)).join(", ")})`;

/** `tuple(address,uint32,…)` reads as `tuple`; a label is not a signature. */
const shortType = (type?: string): string =>
  (type ?? "?").replace(/^tuple\([^)]*\)/, "tuple");

export interface IDecodedParam {
  name: string;
  type: string;
  value: unknown;
}

export interface IDecodedCall {
  selector: string;
  data: string;
  functionName?: string;
  contractName?: string;
  /** e.g. transfer(address,uint256) */
  signature?: string;
  params: IDecodedParam[];
}

const normalizeWeb3Value = (value: unknown): unknown =>
  cleanComplexWeb3Data(value);

const normalizeEthersValue = (
  value: unknown,
  type: ethers.ParamType,
): unknown => {
  if (type.baseType === "array" && Array.isArray(value)) {
    return value.map((item) =>
      normalizeEthersValue(item, type.arrayChildren as ethers.ParamType),
    );
  }
  if (type.baseType === "tuple" && type.components) {
    const out: Record<string, unknown> = {};
    type.components.forEach((component, i) => {
      out[component.name || String(i)] = normalizeEthersValue(
        (value as any)?.[i],
        component,
      );
    });
    return out;
  }
  if (typeof value === "bigint") return value.toString();
  return value;
};

export const decodeCallWithFragment = (
  data: string,
  fragment: AbiFunctionFragment,
  contractName?: string,
): IDecodedCall => {
  const selector = (data ?? "").slice(0, 10).toLowerCase();
  const inputs = (fragment.inputs ?? []) as AbiParameter[];
  const signature = `${fragment.name}(${inputs.map((input) => input.type).join(",")})`;
  try {
    const raw: any = eth.abi.decodeParameters(inputs, data.slice(10));
    const params = inputs.map((input, i) => ({
      name: input.name || `arg${i}`,
      type: input.type,
      value: normalizeWeb3Value(input.name ? raw[input.name] : raw[i]),
    }));
    return { selector, data, functionName: fragment.name, contractName, signature, params };
  } catch {
    return { selector, data, functionName: fragment.name, contractName, signature, params: [] };
  }
};

/**
 * Decode against the contracts we ship ABIs for. A call this cannot name
 * comes back with just its selector; the caller may then try an explorer ABI.
 */
export const decodeCallWithKnownAbis = (data: string): IDecodedCall => {
  const selector = (data ?? "").slice(0, 10).toLowerCase();
  if (!data || data === "0x" || data.length < 10) {
    return { selector: "", data: data ?? "0x", params: [] };
  }
  const known = resolveKnownFunction(selector);
  if (known) return decodeCallWithFragment(data, known.function, known.contractName);
  return decodeCallWithAbi(data, EXTRA_SIGNATURES) ?? { selector, data, params: [] };
};

/**
 * The call inside a `fundFlowsCall(bytes)`: what the vault would forward to
 * its flows delegate. Undefined when the wrapper's bytes are missing.
 */
export const decodeFlowsCall = (
  decoded: Record<string, any> | undefined,
): IDecodedCall | undefined => {
  const data: string | undefined = decoded?.flowCall ?? decoded?.data;
  if (!data || typeof data !== "string" || data.length < 10) return undefined;
  return decodeCallWithKnownAbis(data);
};

export const decodeCallWithAbi = (
  data: string,
  abi: JsonFragment[] | string[] | string,
): IDecodedCall | undefined => {
  try {
    const iface = new ethers.Interface(
      typeof abi === "string" ? JSON.parse(abi) : abi,
    );
    const parsed = iface.parseTransaction({ data });
    if (!parsed) return undefined;
    const params = parsed.fragment.inputs.map((input, i) => ({
      name: input.name || `arg${i}`,
      type: input.type,
      value: normalizeEthersValue(parsed.args[i], input),
    }));
    return {
      selector: parsed.selector.toLowerCase(),
      data,
      functionName: parsed.name,
      signature: parsed.signature,
      params,
    };
  } catch {
    return undefined;
  }
};

/** The inputs of a selector in an ABI, for naming condition parameters. */
export const findFragmentInputs = (
  abi: JsonFragment[] | string | undefined,
  selector: string,
): ethers.ParamType[] | undefined => {
  if (!abi || !selector) return undefined;
  try {
    const iface = new ethers.Interface(
      typeof abi === "string" ? JSON.parse(abi) : abi,
    );
    const fragment = iface.getFunction(selector);
    return fragment ? [...fragment.inputs] : undefined;
  } catch {
    return undefined;
  }
};

/* ---- Safe execution ----------------------------------------------------- */

export interface IInnerCall {
  to: string;
  /** wei, as a decimal string */
  value: string;
  /** 0 = call, 1 = delegatecall */
  operation: number;
  data: string;
  call: IDecodedCall;
}

export interface IExecutionDescription {
  to: string;
  value: string;
  operation: number;
  data: string;
  /** true when the Safe call is a MultiSend batch that was unpacked */
  isBatch: boolean;
  calls: IInnerCall[];
}

const wordToBigInt = (bytes: Uint8Array): bigint =>
  bytes.length ? BigInt(ethers.hexlify(bytes)) : 0n;

/**
 * Unpack MultiSend's packed transaction list: for each entry one byte of
 * operation, 20 of target, 32 of value, 32 of data length, then the data.
 */
export const unpackMultiSend = (transactions: string): IInnerCall[] => {
  const bytes = ethers.getBytes(transactions);
  const calls: IInnerCall[] = [];
  let offset = 0;
  while (offset + 85 <= bytes.length) {
    const operation = bytes[offset];
    offset += 1;
    const to = ethers.getAddress(ethers.hexlify(bytes.slice(offset, offset + 20)));
    offset += 20;
    const value = wordToBigInt(bytes.slice(offset, offset + 32)).toString();
    offset += 32;
    const dataLength = Number(wordToBigInt(bytes.slice(offset, offset + 32)));
    offset += 32;
    if (offset + dataLength > bytes.length) break;
    const data = ethers.hexlify(bytes.slice(offset, offset + dataLength));
    offset += dataLength;
    calls.push({ operation, to, value, data, call: decodeCallWithKnownAbis(data) });
  }
  return calls;
};

/**
 * What a Safe `execTransaction` call actually does. The direct-execution flow
 * wraps every proposal step in a MultiSend delegatecall, so most of the time
 * the interesting part is the list of calls inside the batch.
 */
export const describeExecution = (
  decoded: Record<string, any> | undefined,
): IExecutionDescription => {
  const to = decoded?.to ?? "";
  const value = String(decoded?.value ?? "0");
  const operation = Number(decoded?.operation ?? 0);
  const data: string = decoded?.data ?? "0x";

  if (data.slice(0, 10).toLowerCase() === MULTISEND_SELECTOR) {
    try {
      const [transactions] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["bytes"],
        "0x" + data.slice(10),
      );
      return {
        to,
        value,
        operation,
        data,
        isBatch: true,
        calls: unpackMultiSend(transactions),
      };
    } catch {
      // fall through to a single-call description
    }
  }
  return {
    to,
    value,
    operation,
    data,
    isBatch: false,
    calls: [{ to, value, operation, data, call: decodeCallWithKnownAbis(data) }],
  };
};

/* ---- Roles permissions -------------------------------------------------- */

export type PermissionAction =
  | "allow-target"
  | "scope-target"
  | "revoke-target"
  | "allow-function"
  | "scope-function"
  | "revoke-function"
  | "scope-parameter"
  | "unscope-parameter"
  | "set-execution-options"
  | "assign-roles"
  | "set-default-role"
  | "set-allowance"
  | "enable-module"
  | "disable-module"
  | "transfer-ownership"
  | "renounce-ownership"
  | "rewire"
  | "other";

export type PermissionTone = "grant" | "restrict" | "revoke" | "neutral" | "danger";

export interface IV1ParamCondition {
  index: number;
  comparison: string;
  values: string[];
}

export interface IConditionNode {
  index: number;
  parent: number;
  paramType: RolesV2ParameterType;
  operator: RolesV2Operator;
  compValue: string;
  children: IConditionNode[];
}

export interface IAllowanceDescription {
  key: string;
  balance: string;
  maxRefill: string;
  refill: string;
  period: string;
  timestamp: string;
}

export interface IPermissionDescription {
  action: PermissionAction;
  tone: PermissionTone;
  functionName: string;
  role?: string;
  target?: string;
  selector?: string;
  executionOption?: string;
  module?: string;
  memberships?: { role: string; added: boolean }[];
  conditions?: IConditionNode;
  v1Params?: IV1ParamCondition[];
  allowance?: IAllowanceDescription;
  newOwner?: string;
  warning?: string;
}

const shortHex = (hex: string): string =>
  hex.length > 18 ? `${hex.slice(0, 10)}…${hex.slice(-6)}` : hex;

/** A Roles role, v1 (numeric id) or v2 (bytes32 key), as people call it. */
export const formatRoleKey = (roleKey: unknown): string => {
  if (roleKey === undefined || roleKey === null) return "?";
  const asString = String(roleKey);
  if (/^\d+$/.test(asString)) return `#${asString}`;
  try {
    const decoded = ethers.decodeBytes32String(asString);
    if (decoded) return decoded;
  } catch {
    // not a clean UTF-8 key, show the hex
  }
  return shortHex(asString);
};

export const describeExecutionOptions = (options: unknown): string => {
  switch (Number(options)) {
    case 1:
      return "may send ETH with the call";
    case 2:
      return "may delegatecall";
    case 3:
      return "may send ETH and delegatecall";
    default:
      return "plain calls only, no ETH, no delegatecall";
  }
};

const V1_COMPARISON: Record<number, string> = {
  0: "must equal",
  1: "must be greater than",
  2: "must be less than",
  3: "must be one of",
};

export const buildConditionTree = (
  flat: Record<string, any>[] | undefined,
): IConditionNode | undefined => {
  if (!flat?.length) return undefined;
  const nodes: IConditionNode[] = flat.map((condition, index) => ({
    index,
    parent: Number(condition.parent ?? 0),
    paramType: Number(condition.paramType ?? 0),
    operator: Number(condition.operator ?? 0),
    compValue: condition.compValue ?? "0x",
    children: [],
  }));
  nodes.forEach((node) => {
    if (node.index === 0) return;
    nodes[node.parent]?.children.push(node);
  });
  return nodes[0];
};

export const describePermission = (
  functionName: string | undefined,
  decoded: Record<string, any> | undefined,
): IPermissionDescription => {
  const d = decoded ?? {};
  const name = functionName ?? "";
  const role = d.roleKey ?? d.role;
  const roleLabel = role !== undefined ? formatRoleKey(role) : undefined;
  const base = {
    functionName: name,
    role: roleLabel,
    target: d.targetAddress,
    selector: d.selector ?? d.functionSig,
  };

  switch (name) {
    case "allowTarget":
      return {
        ...base,
        action: "allow-target",
        tone: "grant",
        executionOption: describeExecutionOptions(d.options),
      };
    case "scopeTarget":
      return { ...base, action: "scope-target", tone: "restrict" };
    case "revokeTarget":
      return { ...base, action: "revoke-target", tone: "revoke" };
    case "allowFunction":
    case "scopeAllowFunction":
      return {
        ...base,
        action: "allow-function",
        tone: "grant",
        executionOption: describeExecutionOptions(d.options),
      };
    case "revokeFunction":
    case "scopeRevokeFunction":
      return { ...base, action: "revoke-function", tone: "revoke" };
    case "scopeFunction": {
      if (Array.isArray(d.conditions)) {
        return {
          ...base,
          action: "scope-function",
          tone: "restrict",
          executionOption: describeExecutionOptions(d.options),
          conditions: buildConditionTree(d.conditions),
        };
      }
      const v1Params: IV1ParamCondition[] = [];
      (d.isParamScoped ?? []).forEach((scoped: boolean, i: number) => {
        if (!scoped) return;
        v1Params.push({
          index: i,
          comparison: V1_COMPARISON[Number(d.paramComp?.[i])] ?? "must satisfy",
          values: [d.compValue?.[i] ?? "0x"],
        });
      });
      return {
        ...base,
        action: "scope-function",
        tone: "restrict",
        executionOption: describeExecutionOptions(d.options),
        v1Params,
      };
    }
    case "scopeParameter":
      return {
        ...base,
        action: "scope-parameter",
        tone: "restrict",
        v1Params: [
          {
            index: Number(d.paramIndex),
            comparison: V1_COMPARISON[Number(d.paramComp)] ?? "must satisfy",
            values: [d.compValue ?? "0x"],
          },
        ],
      };
    case "scopeParameterAsOneOf":
      return {
        ...base,
        action: "scope-parameter",
        tone: "restrict",
        v1Params: [
          {
            index: Number(d.paramIndex),
            comparison: V1_COMPARISON[3],
            values: d.compValues ?? [],
          },
        ],
      };
    case "unscopeParameter":
      return {
        ...base,
        action: "unscope-parameter",
        tone: "grant",
        v1Params: [{ index: Number(d.paramIndex), comparison: "may be any value", values: [] }],
      };
    case "scopeFunctionExecutionOptions":
      return {
        ...base,
        action: "set-execution-options",
        tone: "neutral",
        executionOption: describeExecutionOptions(d.options),
      };
    case "assignRoles": {
      const keys: unknown[] = d.roleKeys ?? d._roles ?? [];
      const memberOf: boolean[] = d.memberOf ?? [];
      const memberships = keys.map((key, i) => ({
        role: formatRoleKey(key),
        added: Boolean(memberOf[i]),
      }));
      return {
        ...base,
        action: "assign-roles",
        tone: memberships.some((m) => m.added) ? "grant" : "revoke",
        module: d.module,
        memberships,
      };
    }
    case "setDefaultRole":
      return {
        ...base,
        action: "set-default-role",
        tone: "neutral",
        module: d.module,
        role: formatRoleKey(d.roleKey ?? d.role),
      };
    case "setAllowance":
      return {
        ...base,
        action: "set-allowance",
        tone: "neutral",
        allowance: {
          key: formatRoleKey(d.key),
          balance: String(d.balance ?? "0"),
          maxRefill: String(d.maxRefill ?? "0"),
          refill: String(d.refill ?? "0"),
          period: String(d.period ?? "0"),
          timestamp: String(d.timestamp ?? "0"),
        },
      };
    case "enableModule":
      return {
        ...base,
        action: "enable-module",
        tone: "danger",
        module: d.module,
        warning:
          "Enables a new module on the Roles modifier. A module can execute through it without any role check.",
      };
    case "disableModule":
      return { ...base, action: "disable-module", tone: "revoke", module: d.module };
    case "transferOwnership":
      return {
        ...base,
        action: "transfer-ownership",
        tone: "danger",
        newOwner: d.newOwner,
        warning:
          "Hands ownership of the permission system to a new address. The vault's governor would no longer control who can do what.",
      };
    case "renounceOwnership":
      return {
        ...base,
        action: "renounce-ownership",
        tone: "danger",
        warning:
          "Permanently gives up ownership of the permission system. Nobody could change permissions afterwards.",
      };
    case "setAvatar":
    case "setTarget":
    case "setGuard":
    case "setMultisend":
    case "setTransactionUnwrapper":
      return {
        ...base,
        action: "rewire",
        tone: "danger",
        warning:
          "Changes the Roles modifier's wiring: where permitted calls are executed from, or how they are checked.",
      };
    default:
      return { ...base, action: "other", tone: "neutral" };
  }
};

/* ---- Condition rendering ------------------------------------------------ */

/**
 * The name of the parameter a Roles v1 condition points at. v1's paramIndex
 * is the 32-byte word position in the calldata, which for a function taking
 * a struct means the struct's fields counted one by one — the same
 * flattening the permission editor uses. Unknown ABI or an index past the
 * end fall back to the bare index, 0-based like the calldata.
 */
export const v1ParamLabel = (
  inputs: ethers.ParamType[] | undefined,
  index: number,
): string => {
  const fallback = `parameter at index ${index}`;
  if (!inputs?.length) return fallback;
  try {
    const flat = flattenAbiFunctionInputs(inputs);
    const param = flat[index];
    if (!param) return fallback;
    const name = param.name || param.type;
    return param.parentName ? `${param.parentName}.${name}` : name;
  } catch {
    return fallback;
  }
};

export interface IConditionLine {
  depth: number;
  label: string;
  text: string;
  muted?: boolean;
}

/**
 * A comparison value as a person would read it. With the parameter's ABI type
 * it decodes properly (compValue is plain abi.encode(value)); without one it
 * reads a lone 32-byte word as an address when it looks like one and as a
 * number otherwise.
 */
export const formatCompValue = (
  compValue: string,
  type?: ethers.ParamType,
): string => {
  if (!compValue || compValue === "0x") return "(empty)";
  if (type) {
    try {
      const [decoded] = ethers.AbiCoder.defaultAbiCoder().decode([type], compValue);
      const normalized = normalizeEthersValue(decoded, type);
      if (typeof normalized === "string" || typeof normalized === "number" || typeof normalized === "boolean") {
        return String(normalized);
      }
      return JSON.stringify(normalized);
    } catch {
      // fall through to the untyped reading
    }
  }
  if (compValue.length === 66) {
    const word = compValue.slice(2);
    if (/^0{24}[0-9a-fA-F]{40}$/.test(word) && !/^0{24}0{20}/.test(word)) {
      try {
        return ethers.getAddress("0x" + word.slice(24));
      } catch {
        // not an address after all
      }
    }
    try {
      return BigInt(compValue).toString();
    } catch {
      // unreadable word
    }
  }
  return shortHex(compValue);
};

const OPERATOR_TEXT: Partial<Record<RolesV2Operator, string>> = {
  [RolesV2Operator.EqualTo]: "must equal",
  [RolesV2Operator.GreaterThan]: "must be greater than",
  [RolesV2Operator.LessThan]: "must be less than",
  [RolesV2Operator.SignedIntGreaterThan]: "must be greater than",
  [RolesV2Operator.SignedIntLessThan]: "must be less than",
  [RolesV2Operator.Bitmask]: "must match bitmask",
};

const GROUP_TEXT: Partial<Record<RolesV2Operator, string>> = {
  [RolesV2Operator.And]: "all of the following",
  [RolesV2Operator.Or]: "any of the following",
  [RolesV2Operator.Nor]: "none of the following",
  [RolesV2Operator.Matches]: "must match",
  [RolesV2Operator.ArraySome]: "at least one element must match",
  [RolesV2Operator.ArrayEvery]: "every element must match",
  [RolesV2Operator.ArraySubset]: "elements must be a subset of",
};

const childType = (
  type: ethers.ParamType | undefined,
  index: number,
): ethers.ParamType | undefined => {
  if (!type) return undefined;
  if (type.baseType === "array") return type.arrayChildren ?? undefined;
  if (type.baseType === "tuple") return type.components?.[index];
  return undefined;
};

const childLabel = (
  type: ethers.ParamType | undefined,
  index: number,
  fallback: string,
): string => {
  if (type?.baseType === "tuple") {
    const component = type.components?.[index];
    if (component?.name) return component.name;
    return `field ${index + 1}`;
  }
  if (type?.baseType === "array") return `element`;
  return fallback;
};

const describeNode = (
  node: IConditionNode,
  depth: number,
  label: string,
  type: ethers.ParamType | undefined,
  lines: IConditionLine[],
) => {
  const typeHint = type ? ` (${type.type})` : "";
  switch (node.operator) {
    case RolesV2Operator.Pass:
      lines.push({ depth, label: label + typeHint, text: "any value", muted: true });
      return;
    case RolesV2Operator.EqualToAvatar:
      lines.push({ depth, label: label + typeHint, text: "must be the vault's Safe" });
      return;
    case RolesV2Operator.WithinAllowance:
      lines.push({
        depth,
        label: label + typeHint,
        text: `must stay within allowance "${formatRoleKey(node.compValue)}"`,
      });
      return;
    case RolesV2Operator.EtherWithinAllowance:
      lines.push({
        depth,
        label,
        text: `ETH sent must stay within allowance "${formatRoleKey(node.compValue)}"`,
      });
      return;
    case RolesV2Operator.CallWithinAllowance:
      lines.push({
        depth,
        label,
        text: `calls must stay within allowance "${formatRoleKey(node.compValue)}"`,
      });
      return;
    case RolesV2Operator.Custom:
      lines.push({
        depth,
        label: label + typeHint,
        text: `must pass a custom check at ${formatCompValue(node.compValue)}`,
      });
      return;
    default:
      break;
  }

  const comparison = OPERATOR_TEXT[node.operator];
  if (comparison) {
    lines.push({
      depth,
      label: label + typeHint,
      text: `${comparison} ${formatCompValue(node.compValue, type)}`,
    });
    return;
  }

  const group = GROUP_TEXT[node.operator];
  if (group) {
    // A logical group keeps its parent's parameter and type; a structural
    // match descends into the tuple's fields or the array's elements.
    const isLogical = [RolesV2Operator.And, RolesV2Operator.Or, RolesV2Operator.Nor].includes(node.operator);
    lines.push({ depth, label: label + typeHint, text: group + ":" });
    node.children.forEach((child, i) => {
      if (isLogical) {
        describeNode(child, depth + 1, `option ${i + 1}`, type, lines);
      } else {
        describeNode(child, depth + 1, childLabel(type, i, `field ${i + 1}`), childType(type, i), lines);
      }
    });
    return;
  }

  lines.push({
    depth,
    label: label + typeHint,
    text: `operator ${node.operator} with ${formatCompValue(node.compValue)}`,
  });
};

/**
 * Flatten a Roles v2 condition tree into indented lines. The root describes
 * the calldata itself, so its children are the function's parameters and get
 * named after them when the ABI is known.
 */
export const describeConditionTree = (
  root: IConditionNode | undefined,
  inputs?: ethers.ParamType[],
): IConditionLine[] => {
  const lines: IConditionLine[] = [];
  if (!root) return lines;
  const rootIsCalldata =
    root.paramType === RolesV2ParameterType.Calldata ||
    root.paramType === RolesV2ParameterType.AbiEncoded;
  if (rootIsCalldata && root.operator === RolesV2Operator.Matches) {
    root.children.forEach((child, i) => {
      const input = inputs?.[i];
      describeNode(child, 0, input?.name || `parameter ${i + 1}`, input, lines);
    });
    return lines;
  }
  describeNode(root, 0, "calldata", undefined, lines);
  return lines;
};

/* ---- Vault settings ----------------------------------------------------- */

export type SettingsRowKind =
  | "text"
  | "address"
  | "list"
  | "percent"
  | "url"
  | "bool"
  | "days"
  | "number";

export interface ISettingsRow {
  key: string;
  label: string;
  kind: SettingsRowKind;
  proposed: string | string[];
  current?: string | string[];
  /** false when there is nothing to compare against */
  comparable: boolean;
  changed: boolean;
}

export interface ISettingsSection {
  name: string;
  rows: ISettingsRow[];
}

const normalizeForCompare = (value: string | string[] | undefined, kind: SettingsRowKind): string => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.map((v) => v.trim().toLowerCase()).sort().join("\n");
  }
  const trimmed = String(value).trim();
  if (kind === "address") return trimmed.toLowerCase();
  if (kind === "days") return trimmed === "0" ? "365" : trimmed;
  if (kind === "percent" || kind === "number") {
    const asNumber = Number(trimmed);
    return Number.isNaN(asNumber) ? trimmed : String(asNumber);
  }
  if (kind === "bool") return trimmed === "true" ? "true" : "false";
  return trimmed;
};

const row = (
  key: string,
  label: string,
  kind: SettingsRowKind,
  proposed: string | string[] | undefined,
  current: string | string[] | undefined,
): ISettingsRow => {
  const proposedValue = proposed ?? (kind === "list" ? [] : "");
  const comparable = current !== undefined;
  return {
    key,
    label,
    kind,
    proposed: proposedValue,
    current,
    comparable,
    changed: comparable && normalizeForCompare(proposedValue, kind) !== normalizeForCompare(current, kind),
  };
};

const percent = (bps: unknown): string => fromBpsToPercentage(bps);
const orUndefined = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

/**
 * The rows of an `updateSettings` proposal against the vault as it stands.
 * `current` may be a partial vault when the store has not finished loading;
 * rows without a current value simply are not compared.
 */
export const buildSettingsSections = (
  decoded: Record<string, any> | undefined,
  current?: Partial<IFund> | null,
): ISettingsSection[] => {
  const settings = decoded?._fundSettings ?? {};
  let metadata: Record<string, any> = {};
  try {
    metadata = decoded?._fundMetadata ? JSON.parse(decoded._fundMetadata) : {};
  } catch {
    metadata = {};
  }
  const fund = current ?? undefined;
  const collectors: string[] = settings.feeCollectors ?? [];

  return [
    {
      name: "Basics",
      rows: [
        row("fundName", "Vault name", "text", settings.fundName, fund?.title),
        row("fundSymbol", "Vault token symbol", "text", settings.fundSymbol, fund?.fundToken?.symbol),
        row("baseToken", "Denomination asset", "address", settings.baseToken, fund?.baseToken?.address),
        row("description", "Description", "text", metadata.description, fund?.description),
        row("strategistName", "Strategist name", "text", metadata.strategistName, fund?.strategistName),
        row("strategistUrl", "Strategist link", "url", metadata.strategistUrl, fund?.strategistUrl),
        row("oivChatUrl", "Vault chat link", "url", metadata.oivChatUrl, fund?.oivChatUrl),
        row("photoUrl", "Photo URL", "url", metadata.photoUrl, fund?.photoUrl),
      ],
    },
    {
      name: "Fees",
      rows: [
        row("depositFee", "Deposit fee", "percent", percent(settings.depositFee), fund?.depositFee !== undefined ? percent(fund.depositFee) : undefined),
        row("depositFeeRecipient", "Deposit fee recipient", "address", collectors[0], fund?.depositFeeAddress),
        row("withdrawFee", "Redemption fee", "percent", percent(settings.withdrawFee), fund?.withdrawFee !== undefined ? percent(fund.withdrawFee) : undefined),
        row("withdrawFeeRecipient", "Redemption fee recipient", "address", collectors[1], fund?.withdrawFeeAddress),
        row("managementFee", "Management fee", "percent", percent(settings.managementFee), fund?.managementFee !== undefined ? percent(fund.managementFee) : undefined),
        row("managementFeeRecipient", "Management fee recipient", "address", collectors[2], fund?.managementFeeAddress),
        row("managementFeePeriod", "Management fee period", "days", orUndefined(decoded?._feeManagePeriod), fund?.managementPeriod),
        row("performanceFee", "Performance fee", "percent", percent(settings.performanceFee), fund?.performanceFee !== undefined ? percent(fund.performanceFee) : undefined),
        row("performanceFeeRecipient", "Performance fee recipient", "address", collectors[3], fund?.performanceFeeAddress),
        row("performanceFeePeriod", "Performance fee period", "days", orUndefined(decoded?._feePerformancePeriod), fund?.performancePeriod),
        row("hurdleRate", "Hurdle rate", "percent", percent(settings.performaceHurdleRateBps), fund?.performaceHurdleRateBps !== undefined ? percent(fund.performaceHurdleRateBps) : undefined),
      ],
    },
    {
      name: "Deposits",
      rows: [
        row("isWhitelistedDeposits", "Whitelisted deposits only", "bool", orUndefined(settings.isWhitelistedDeposits), fund?.isWhitelistedDeposits !== undefined ? String(fund.isWhitelistedDeposits) : undefined),
        row("whitelist", "Deposit whitelist", "list", settings.allowedDepositAddrs ?? [], fund?.allowedDepositAddresses),
        row("allowedManagers", "Allowed managers", "list", settings.allowedManagers ?? [], fund?.allowedManagerAddresses),
      ],
    },
    {
      name: "Management",
      rows: [
        row("plannedSettlementPeriod", "Planned settlement period", "text", orUndefined(metadata.plannedSettlementPeriod), fund?.plannedSettlementPeriod),
        row("minLiquidAssetShare", "Min. liquid asset share", "percent", orUndefined(metadata.minLiquidAssetShare), fund?.minLiquidAssetShare),
      ],
    },
    {
      name: "Core addresses",
      rows: [
        row("governanceToken", "Governance token", "address", settings.governanceToken, fund?.governanceToken?.address),
        row("isExternalGovTokenInUse", "External governance token", "bool", orUndefined(settings.isExternalGovTokenInUse), undefined),
        row("governor", "Governor", "address", settings.governor, fund?.governorAddress),
        row("safe", "Safe", "address", settings.safe, fund?.safeAddress),
        row("fundAddress", "Vault address", "address", settings.fundAddress, fund?.address),
      ],
    },
  ];
};

export const countChangedSettings = (sections: ISettingsSection[]): number =>
  sections.reduce(
    (sum, section) => sum + section.rows.filter((r) => r.changed).length,
    0,
  );

/** Days as the contract stores them: 0 means the 365-day default. */
export const formatFeePeriodDays = (value: string | string[]): string => {
  const days = String(value);
  if (days === "0" || days === "") return "365 days (default)";
  return `${days} ${days === "1" ? "day" : "days"}`;
};
