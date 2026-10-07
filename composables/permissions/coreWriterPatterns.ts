import { ethers } from "ethers";
import { RolesV2Operator } from "~/composables/permissions/rolesV2Permissions";
import type { IConditionNode } from "~/composables/proposal/describeProposalActions";
import { CORE_USDC_SYSTEM } from "~/composables/contracts/contractNames";

/**
 * Roles v2 rules on HyperCore's CoreWriter.sendRawAction(bytes), read back as
 * the instructions they allow.
 *
 * A HyperCore instruction is one byte of version (1), a 3-byte action id and
 * the action's abi-encoded arguments. Roles v2 restricts such a blob with
 * byte checks ("bitmasks": at this offset, these bytes under this mask) and
 * exact values, grouped with "all of" and "any of". This module turns a rule
 * back into which bytes it fixes, then into an action and its arguments, so
 * "must match bitmask 17668470643…" reads "Move USDC between spot and perp,
 * any amount".
 */

/** The bytes a rule fixes, by offset into the instruction. Absent = any value. */
export type BytePattern = Map<number, { mask: number; value: number }>;

/** A v2 bitmask compValue: uint16 shift, bytes15 mask, bytes15 expected. */
export const decodeBitmask = (compValue: string) => {
  const hex = (compValue.startsWith("0x") ? compValue.slice(2) : compValue).padStart(64, "0");
  const bytes = (from: number, to: number) =>
    Array.from({ length: (to - from) / 2 }, (_, i) => parseInt(hex.slice(from + i * 2, from + i * 2 + 2), 16));
  return { shift: parseInt(hex.slice(0, 4), 16), mask: bytes(4, 34), expected: bytes(34, 64) };
};

/** A bitmask as words: "bytes 0–3 must be 0x01000007". */
export const describeBitmask = (compValue: string): string => {
  const { shift, mask, expected } = decodeBitmask(compValue);
  let last = mask.length - 1;
  while (last > 0 && mask[last] === 0) last--;
  let first = 0;
  while (first < last && mask[first] === 0) first++;
  const span = (list: number[]) => "0x" + list.slice(first, last + 1).map((b) => b.toString(16).padStart(2, "0")).join("");
  const range = first === last ? `byte ${shift + first}` : `bytes ${shift + first}–${shift + last}`;
  const full = mask.slice(first, last + 1).every((b) => b === 0xff);
  return full
    ? `${range} must be ${span(expected)}`
    : `${range} must be ${span(expected)} under mask ${span(mask)}`;
};

const merge = (a: BytePattern, b: BytePattern): BytePattern | undefined => {
  const out: BytePattern = new Map(a);
  for (const [offset, { mask, value }] of b) {
    const prior = out.get(offset);
    if (!prior) {
      out.set(offset, { mask, value });
      continue;
    }
    // Both checks hold: they must agree wherever both look.
    const shared = prior.mask & mask;
    if ((prior.value & shared) !== (value & shared)) return undefined;
    out.set(offset, { mask: prior.mask | mask, value: (prior.value & prior.mask) | (value & mask) });
  }
  return out;
};

/** Keeps "all of" groups of "any of" groups from multiplying without end. */
const MAX_PATTERNS = 64;

/**
 * The byte patterns a condition node allows: one per way of satisfying it.
 * Undefined when the node uses something other than byte checks, exact
 * values, "all of" and "any of".
 */
export const patternsOf = (node: IConditionNode): BytePattern[] | undefined => {
  switch (node.operator) {
    case RolesV2Operator.Pass:
      return [new Map()];
    case RolesV2Operator.Bitmask: {
      const { shift, mask, expected } = decodeBitmask(node.compValue);
      const pattern: BytePattern = new Map();
      mask.forEach((m, i) => {
        if (m) pattern.set(shift + i, { mask: m, value: expected[i] & m });
      });
      return [pattern];
    }
    case RolesV2Operator.EqualTo: {
      const bytes = ethers.getBytes(node.compValue.startsWith("0x") ? node.compValue : "0x" + node.compValue);
      return [new Map([...bytes].map((value, i) => [i, { mask: 0xff, value }]))];
    }
    case RolesV2Operator.Or: {
      const all: BytePattern[] = [];
      for (const child of node.children) {
        const list = patternsOf(child);
        if (!list) return undefined;
        all.push(...list);
      }
      return all.length <= MAX_PATTERNS ? all : undefined;
    }
    case RolesV2Operator.And: {
      let all: BytePattern[] = [new Map()];
      for (const child of node.children) {
        const list = patternsOf(child);
        if (!list) return undefined;
        const next: BytePattern[] = [];
        for (const a of all) {
          for (const b of list) {
            const merged = merge(a, b);
            if (merged) next.push(merged);
          }
        }
        if (next.length > MAX_PATTERNS) return undefined;
        all = next;
      }
      return all;
    }
    default:
      return undefined;
  }
};

/* ---- HyperCore actions ---------------------------------------------------- */

type ArgType = "address" | "bool" | "uint8" | "uint32" | "uint64" | "uint128" | "string";

/**
 * HyperCore's CoreWriter actions and their arguments, as Hyperliquid
 * documents them ("Interacting with HyperCore").
 */
const ACTIONS: Record<number, { name: string; args: [string, ArgType][] }> = {
  1: { name: "limitOrder", args: [["asset", "uint32"], ["isBuy", "bool"], ["limitPx", "uint64"], ["sz", "uint64"], ["reduceOnly", "bool"], ["tif", "uint8"], ["cloid", "uint128"]] },
  2: { name: "vaultTransfer", args: [["vault", "address"], ["isDeposit", "bool"], ["usd", "uint64"]] },
  3: { name: "tokenDelegate", args: [["validator", "address"], ["wei", "uint64"], ["isUndelegate", "bool"]] },
  4: { name: "stakingDeposit", args: [["wei", "uint64"]] },
  5: { name: "stakingWithdraw", args: [["wei", "uint64"]] },
  6: { name: "spotSend", args: [["destination", "address"], ["token", "uint64"], ["wei", "uint64"]] },
  7: { name: "usdClassTransfer", args: [["ntl", "uint64"], ["toPerp", "bool"]] },
  8: { name: "finalizeEvmContract", args: [["token", "uint64"], ["variant", "uint8"], ["createNonce", "uint64"]] },
  9: { name: "addApiWallet", args: [["agent", "address"], ["name", "string"]] },
  10: { name: "cancelOrderByOid", args: [["asset", "uint32"], ["oid", "uint64"]] },
  11: { name: "cancelOrderByCloid", args: [["asset", "uint32"], ["cloid", "uint128"]] },
  12: { name: "approveBuilderFee", args: [["maxFeeRate", "uint64"], ["builder", "address"]] },
  13: { name: "sendAsset", args: [["destination", "address"], ["subAccount", "address"], ["sourceDex", "uint32"], ["destinationDex", "uint32"], ["token", "uint64"], ["wei", "uint64"]] },
  14: { name: "reflectEvmSupplyChange", args: [["token", "uint64"], ["wei", "uint64"], ["isMint", "bool"]] },
  15: { name: "borrowLend", args: [["operation", "uint8"], ["token", "uint64"], ["wei", "uint64"]] },
};

/** How a rule leaves one argument: fixed to a value, open, or partly fixed. */
type Arg =
  | { state: "fixed"; value: bigint | string | boolean }
  | { state: "any" }
  | { state: "partial" };

const WORD = 32;
const ARGS_AT = 4;

const readWord = (pattern: BytePattern, at: number): { known: boolean[]; bytes: number[] } => {
  const known: boolean[] = [];
  const bytes: number[] = [];
  for (let i = 0; i < WORD; i++) {
    const byte = pattern.get(at + i);
    known.push(byte?.mask === 0xff);
    bytes.push(byte?.mask === 0xff ? byte.value : 0);
  }
  return { known, bytes };
};

const BYTES_OF: Record<Exclude<ArgType, "string" | "address" | "bool">, number> = { uint8: 1, uint32: 4, uint64: 8, uint128: 16 };

const readArg = (pattern: BytePattern, index: number, type: ArgType): Arg => {
  const at = ARGS_AT + index * WORD;
  if (type === "string") {
    // A string sits behind an offset word; only "left open" is said here.
    for (const offset of pattern.keys()) if (offset >= at) return { state: "partial" };
    return { state: "any" };
  }
  const { known, bytes } = readWord(pattern, at);
  const touched = [...Array(WORD).keys()].some((i) => pattern.has(at + i));
  if (!touched) return { state: "any" };
  const width = type === "address" ? 20 : type === "bool" ? 1 : BYTES_OF[type];
  const low = [...Array(width).keys()].map((i) => WORD - width + i);
  const lowKnown = low.every((i) => known[i]);
  const lowTouched = low.some((i) => pattern.has(at + i));
  // Padding pinned to zero with the value itself left open is still "any".
  if (!lowTouched) return { state: "any" };
  if (!lowKnown) return { state: "partial" };
  const hex = "0x" + low.map((i) => bytes[i].toString(16).padStart(2, "0")).join("");
  if (type === "address") return { state: "fixed", value: ethers.getAddress(hex) };
  if (type === "bool") return { state: "fixed", value: bytes[WORD - 1] !== 0 };
  return { state: "fixed", value: BigInt(hex) };
};

/** A line part: text, or an address the views render as a named chip. */
export type PatternPart = string | { address: string };

const SPOT_DEX = 0xffffffffn;
const dexName = (arg: Arg) =>
  arg.state !== "fixed" ? "any balance" : arg.value === SPOT_DEX ? "spot" : arg.value === 0n ? "perp" : `dex ${arg.value}`;
const tokenName = (arg: Arg) =>
  arg.state !== "fixed" ? "any token" : arg.value === 0n ? "USDC" : `token #${arg.value}`;
const amount = (arg: Arg, decimals: number, unit: string) =>
  arg.state === "fixed"
    ? `exactly ${Number(ethers.formatUnits(arg.value as bigint, decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${unit}`
    : arg.state === "any" ? "any amount" : "limited amounts (see the exact rule)";

/**
 * One allowed instruction in words, or undefined when the rule does not even
 * fix which action it is.
 */
export const describeCorePattern = (pattern: BytePattern): PatternPart[] | undefined => {
  const header = [0, 1, 2, 3].map((i) => pattern.get(i));
  if (header.some((byte) => byte?.mask !== 0xff)) return undefined;
  const [version, ...idBytes] = header.map((byte) => byte!.value);
  if (version !== 1) return [`A HyperCore instruction of version ${version}`];
  const id = (idBytes[0] << 16) | (idBytes[1] << 8) | idBytes[2];
  const action = ACTIONS[id];
  if (!action) return [`HyperCore action type ${id}`];
  const arg = (name: string) => {
    const index = action.args.findIndex(([argName]) => argName === name);
    return readArg(pattern, index, action.args[index][1]);
  };
  const partial = action.args.some((_, i) => readArg(pattern, i, action.args[i][1]).state === "partial");
  const tail = partial ? ", with further limits (see the exact rule)" : "";

  switch (action.name) {
    case "usdClassTransfer": {
      const toPerp = arg("toPerp");
      const direction = toPerp.state === "fixed" ? (toPerp.value ? "from spot to perp" : "from perp to spot") : "between spot and perp";
      return [`Move USDC ${direction}, ${amount(arg("ntl"), 6, "USDC")}${tail}`];
    }
    case "sendAsset": {
      const destination = arg("destination");
      const token = tokenName(arg("token"));
      const how = amount(arg("wei"), 8, token === "USDC" ? "USDC" : "units");
      // Spot to spot is the ordinary route; say the route only when it is not.
      const source = arg("sourceDex");
      const target = arg("destinationDex");
      const ordinary =
        (source.state === "fixed" && target.state === "fixed" && source.value === SPOT_DEX && target.value === SPOT_DEX) ||
        (source.state === "any" && target.state === "any");
      const route = ordinary ? "" : ` (from ${dexName(source)} to ${dexName(target)})`;
      if (destination.state === "fixed" && String(destination.value).toLowerCase() === CORE_USDC_SYSTEM) {
        return [`Move ${token} from HyperCore back to the vault on HyperEVM, ${how}${route}${tail}`];
      }
      if (destination.state === "fixed") {
        return [`Send ${token} to `, { address: String(destination.value) }, ` on HyperCore, ${how}${route}${tail}`];
      }
      return [`Send ${token} to any address on HyperCore, ${how}${route}${tail}`];
    }
    case "spotSend": {
      const destination = arg("destination");
      const token = tokenName(arg("token"));
      const how = amount(arg("wei"), 8, "units");
      return destination.state === "fixed"
        ? [`Send ${token} to `, { address: String(destination.value) }, ` on HyperCore, ${how}${tail}`]
        : [`Send ${token} to any address on HyperCore, ${how}${tail}`];
    }
    case "addApiWallet": {
      const agent = arg("agent");
      return agent.state === "fixed"
        ? ["Register ", { address: String(agent.value) }, ` as the vault's trading agent${tail}`]
        : [`Register any address as the vault's trading agent${tail}`];
    }
    case "limitOrder": {
      const asset = arg("asset");
      return [`Place orders ${asset.state === "fixed" ? `on market #${asset.value}` : "on any market"}${tail}`];
    }
    case "cancelOrderByOid":
    case "cancelOrderByCloid": {
      const asset = arg("asset");
      return [`Cancel orders ${asset.state === "fixed" ? `on market #${asset.value}` : "on any market"}${tail}`];
    }
    case "vaultTransfer": {
      const vault = arg("vault");
      const isDeposit = arg("isDeposit");
      const verb = isDeposit.state === "fixed" ? (isDeposit.value ? "Deposit USD into" : "Withdraw USD from") : "Move USD into or out of";
      return vault.state === "fixed"
        ? [`${verb} the HyperCore vault `, { address: String(vault.value) }, `, ${amount(arg("usd"), 6, "USD")}${tail}`]
        : [`${verb} any HyperCore vault, ${amount(arg("usd"), 6, "USD")}${tail}`];
    }
    case "tokenDelegate": {
      const validator = arg("validator");
      return validator.state === "fixed"
        ? ["Delegate or undelegate HYPE with validator ", { address: String(validator.value) }, tail]
        : [`Delegate or undelegate HYPE with any validator${tail}`];
    }
    case "stakingDeposit":
      return [`Stake HYPE, ${amount(arg("wei"), 8, "HYPE")}${tail}`];
    case "stakingWithdraw":
      return [`Unstake HYPE, ${amount(arg("wei"), 8, "HYPE")}${tail}`];
    case "approveBuilderFee": {
      const builder = arg("builder");
      return builder.state === "fixed"
        ? ["Approve trading fees for builder ", { address: String(builder.value) }, tail]
        : [`Approve trading fees for any builder${tail}`];
    }
    case "finalizeEvmContract":
      return [`Link a token to its HyperEVM contract${tail}`];
    case "reflectEvmSupplyChange":
      return [`Change a linked token's supply on HyperCore${tail}`];
    case "borrowLend":
      return [`Borrow or lend on HyperCore${tail}`];
    default:
      return [`HyperCore action ${action.name}${tail}`];
  }
};

/**
 * The instructions a v2 rule on sendRawAction allows, one line each, or
 * undefined when the rule is not made of byte checks and exact values on the
 * instruction (then only the exact rule can say it).
 */
export const describeCoreWriterRule = (root: IConditionNode | undefined): PatternPart[][] | undefined => {
  if (!root) return undefined;
  // The rule's root is the calldata match; its first child is the instruction.
  const data = root.operator === RolesV2Operator.Matches ? root.children[0] : undefined;
  if (!data) return undefined;
  const patterns = patternsOf(data);
  if (!patterns?.length) return undefined;
  const lines: PatternPart[][] = [];
  for (const pattern of patterns) {
    const line = describeCorePattern(pattern);
    if (!line) return undefined;
    lines.push(line);
  }
  return lines;
};
