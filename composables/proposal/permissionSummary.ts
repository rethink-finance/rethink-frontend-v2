import { ethers } from "ethers";
import { networksMap } from "~/store/web3/networksMap";
import {
  formatCompValue,
  type IConditionNode,
  type IPermissionDescription,
} from "~/composables/proposal/describeProposalActions";
import { flattenAbiFunctionInputs } from "~/composables/zodiac-roles/flattenAbiFunctionInputs";
import { RolesV2Operator } from "~/composables/permissions/rolesV2Permissions";

/**
 * A Roles permission said the way a vault member would say it: who can do
 * what, and the limits that matter, instead of "role #2 may call
 * depositV3Now(address, address, …) only when address must equal …".
 *
 * It recognises the calls vault permissions are actually made of — token
 * transfers and approvals, Across bridging, HyperCore actions — and falls back
 * to naming each restricted argument in words. The exact rule stays one click
 * away on the card, so nothing here has to be complete; it has to be right.
 */

/** Text, or an address the card renders as a named chip. */
export type SummaryPart = string | { address: string };
export type SummaryLine = SummaryPart[];

export interface PermissionSummary {
  /** One plain sentence, used as the card's title. */
  headline: string;
  /** The limits, one per line. */
  lines: SummaryLine[];
  /** Something a reader should stop at (ETH or delegatecall allowed). */
  caution?: string;
}

export interface SummaryContext {
  /** "The manager", "Role 2" — capitalised, sentence-initial. */
  roleName: (role?: string) => string;
  /** A name for an address, or undefined to show it shortened. */
  label: (address: string) => string | undefined;
  /** The function's inputs, where its ABI is known. */
  inputs?: ethers.ParamType[];
  /** The scoped function's name, where known. */
  functionName?: string;
  /** For a scopeTarget: the functions later calls allow there (1-based calls). */
  scopedFunctions?: { index: number; name: string }[];
}

/* ---- Well-known contracts ------------------------------------------------ */

const CORE_WRITER = "0x3333333333333333333333333333333333333333";
/** HyperCore's system address for USDC: sending it here moves USDC back to HyperEVM. */
const CORE_USDC_SYSTEM = "0x2000000000000000000000000000000000000000";

/**
 * Addresses with no explorer name that proposals keep touching. Keyed by
 * lowercase address; the same contract sits at the same address on every
 * chain it is on, except where noted.
 */
export const WELL_KNOWN_LABELS: Record<string, string> = {
  [CORE_WRITER]: "HyperCore (CoreWriter)",
  [CORE_USDC_SYSTEM]: "HyperCore USDC bridge",
  // Across SpokePool on HyperEVM.
  "0x35e63ea3eb0fb7a3bc543c71fb66412e1f6b0e04": "Across bridge",
  // USDC as Circle issues it on Arbitrum One.
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC on Arbitrum",
  // USDC on Base.
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC on Base",
  // 1inch Aggregation Router v6 and v5, same address on every chain.
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch router (v5)",
  // USDC on Ethereum.
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC on Ethereum",
};

const chainName = (decimalChainId: string): string => {
  try {
    const hex = "0x" + BigInt(decimalChainId).toString(16);
    return networksMap[hex]?.chainName ?? `chain ${decimalChainId}`;
  } catch {
    return `chain ${decimalChainId}`;
  }
};

/* ---- Restricted arguments, whatever the Roles version -------------------- */

type PinKind = "equals" | "oneOf" | "below" | "above" | "other";

interface Pin {
  kind: PinKind;
  /** Raw comparison values (abi-encoded), decoded on use. */
  values: string[];
}

/**
 * The top-level restrictions on each argument, by argument index. v1 states
 * them per index; v2 as a Matches node whose children are the arguments.
 * Anything nested deeper than one comparison per argument is reported as
 * "other" and left to the exact rule.
 */
const collectPins = (description: IPermissionDescription): Map<number, Pin> => {
  const pins = new Map<number, Pin>();
  for (const param of description.v1Params ?? []) {
    const kind: PinKind = param.comparison.includes("one of")
      ? "oneOf"
      : param.comparison.includes("greater")
        ? "above"
        : param.comparison.includes("less")
          ? "below"
          : param.comparison.includes("equal")
            ? "equals"
            : "other";
    pins.set(param.index, { kind, values: param.values });
  }

  const root = description.conditions;
  if (root && root.operator === RolesV2Operator.Matches) {
    root.children.forEach((child: IConditionNode, index: number) => {
      const pin = v2Pin(child);
      if (pin) pins.set(index, pin);
    });
  }
  return pins;
};

const v2Pin = (node: IConditionNode): Pin | undefined => {
  switch (node.operator) {
    case RolesV2Operator.Pass:
      return undefined;
    case RolesV2Operator.EqualTo:
      return { kind: "equals", values: [node.compValue] };
    case RolesV2Operator.LessThan:
      return { kind: "below", values: [node.compValue] };
    case RolesV2Operator.GreaterThan:
      return { kind: "above", values: [node.compValue] };
    case RolesV2Operator.Or:
      if (node.children.every((child) => child.operator === RolesV2Operator.EqualTo)) {
        return { kind: "oneOf", values: node.children.map((child) => child.compValue) };
      }
      return { kind: "other", values: [] };
    default:
      return { kind: "other", values: [] };
  }
};

/* ---- Values as words ------------------------------------------------------ */

const decodeValue = (value: string, type?: ethers.ParamType): string =>
  formatCompValue(value, type);

const isAddress = (text: string) => /^0x[0-9a-fA-F]{40}$/.test(text);

/** A decoded value as a line part: addresses become chips, "(empty)" reads as words. */
const valuePart = (text: string): SummaryPart =>
  isAddress(text) ? { address: text } : text === "(empty)" ? "nothing" : text;

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/* ---- HyperCore actions ---------------------------------------------------- */

const coder = () => ethers.AbiCoder.defaultAbiCoder();
const usd = (amount: bigint, decimals: number) =>
  Number(ethers.formatUnits(amount, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

type CoreAction =
  | { kind: "usdClassTransfer"; toPerp: boolean; amount: string }
  | { kind: "sendAsset"; destination: string; token: bigint; amount: string }
  | { kind: "addApiWallet"; agent: string; name: string }
  | { kind: "unknown"; id: number };

/**
 * A CoreWriter action blob: a version byte (1), a 3-byte action id, then the
 * action's abi-encoded arguments. Only the actions Rethink vaults use are
 * named; see composables/execution/crtConsole.ts for the encoders.
 */
export const decodeCoreAction = (hex: string): CoreAction => {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  const id = parseInt(data.slice(2, 8), 16);
  const body = "0x" + data.slice(8);
  try {
    switch (id) {
      case 7: {
        const [ntl, toPerp] = coder().decode(["uint64", "bool"], body);
        return { kind: "usdClassTransfer", toPerp: Boolean(toPerp), amount: usd(BigInt(ntl), 6) };
      }
      case 13: {
        const [destination, , , , token, wei] = coder().decode(
          ["address", "address", "uint32", "uint32", "uint64", "uint64"],
          body,
        );
        return {
          kind: "sendAsset",
          destination: ethers.getAddress(destination),
          token: BigInt(token),
          amount: usd(BigInt(wei), 8),
        };
      }
      case 9: {
        const [agent, name] = coder().decode(["address", "string"], body);
        return { kind: "addApiWallet", agent: ethers.getAddress(agent), name: String(name) };
      }
    }
  } catch {
    // an action we know by id but whose arguments did not decode
  }
  return { kind: "unknown", id };
};

const amountList = (amounts: string[]) =>
  amounts.length === 1 ? `${amounts[0]} USDC` : `${amounts.join(", ")} USDC`;

const coreActionLines = (blobs: string[]): SummaryLine[] => {
  const actions = blobs.map(decodeCoreAction);
  const lines: SummaryLine[] = [];

  for (const toPerp of [true, false]) {
    const amounts = actions
      .filter((a): a is Extract<CoreAction, { kind: "usdClassTransfer" }> =>
        a.kind === "usdClassTransfer" && a.toPerp === toPerp)
      .map((a) => a.amount);
    if (amounts.length) {
      lines.push([
        `Move USDC from ${toPerp ? "spot to perp" : "perp to spot"}, in fixed amounts: ${amountList(amounts)}`,
      ]);
    }
  }

  const sends = new Map<string, string[]>();
  for (const action of actions) {
    if (action.kind !== "sendAsset") continue;
    const key = action.destination.toLowerCase();
    sends.set(key, [...(sends.get(key) ?? []), action.amount]);
  }
  for (const [destination, amounts] of sends) {
    const toEvm = destination === CORE_USDC_SYSTEM;
    lines.push(
      toEvm
        ? [`Move USDC from HyperCore back to the vault on HyperEVM, in fixed amounts: ${amountList(amounts)}`]
        : ["Send USDC to ", { address: destination }, ` on HyperCore, in fixed amounts: ${amountList(amounts)}`],
    );
  }

  for (const action of actions) {
    if (action.kind !== "addApiWallet") continue;
    const name = action.name ? ` under the name “${action.name}”` : "";
    lines.push(["Register ", { address: action.agent }, ` as the vault's trading agent${name}`]);
  }

  const unknown = actions.filter((a) => a.kind === "unknown");
  if (unknown.length) {
    const ids = [...new Set(unknown.map((a) => (a as { id: number }).id))].join(", ");
    lines.push([`${unknown.length} other HyperCore ${unknown.length === 1 ? "action" : "actions"} (type ${ids})`]);
  }
  return lines;
};

/* ---- The summary ---------------------------------------------------------- */

/** Argument names and types by index, flattened the way Roles v1 indexes them. */
const argumentNames = (
  inputs?: ethers.ParamType[],
): { name: string; type?: ethers.ParamType }[] => {
  if (!inputs?.length) return [];
  let flat: any[];
  try {
    flat = flattenAbiFunctionInputs(inputs);
  } catch {
    flat = [...inputs];
  }
  return flat.map((param) => {
    const own = param?.name || "";
    const parent = param?.parentName || "";
    return {
      name: [parent, own].filter(Boolean).join(" ") || `${param?.type ?? "argument"} argument`,
      type: param instanceof ethers.ParamType ? param : undefined,
    };
  });
};

const nameOf = (address: string | undefined, ctx: SummaryContext): string => {
  if (!address) return "a contract";
  const label = ctx.label(address) ?? WELL_KNOWN_LABELS[address.toLowerCase()];
  return label ? label.replace(/\s*\(.*\)$/, "") : shortAddress(address);
};

/** "0x4aAb…2571" or "Vault Safe" — for a headline, where chips cannot go. */
const valueName = (text: string, ctx: SummaryContext): string =>
  isAddress(text) ? nameOf(text, ctx) : text;

/** Decoded values of the pin at `index`, or undefined when unrestricted. */
const pinValues = (
  pins: Map<number, Pin>,
  index: number,
  type?: ethers.ParamType,
): { kind: PinKind; values: string[] } | undefined => {
  const pin = pins.get(index);
  if (!pin) return undefined;
  return { kind: pin.kind, values: pin.values.map((value) => decodeValue(value, type)) };
};

/** A generic restricted argument as a line. */
const argumentLine = (name: string, pin: { kind: PinKind; values: string[] }): SummaryLine => {
  const values = pin.values.map(valuePart);
  const joined: SummaryPart[] = [];
  values.forEach((value, i) => {
    if (i > 0) joined.push(i === values.length - 1 ? " or " : ", ");
    joined.push(value);
  });
  switch (pin.kind) {
    case "equals":
      return [`${capitalise(name)}: only `, ...joined];
    case "oneOf":
      return [`${capitalise(name)}: one of `, ...joined];
    case "below":
      return [`${capitalise(name)}: below `, ...joined];
    case "above":
      return [`${capitalise(name)}: above `, ...joined];
    default:
      return [`${capitalise(name)}: restricted (see the exact rule)`];
  }
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "The manager can…" → "the manager can…", but "Role 2" keeps its capital. */
const lowerFirst = (text: string) => (text.startsWith("The ") ? "the " + text.slice(4) : text);

/** Friendlier words for argument names the ABIs use. */
const ARGUMENT_WORDS: Record<string, string> = {
  to: "recipient",
  receiver: "receiver",
  dstReceiver: "receiver of the swap",
  dstToken: "token bought",
  srcToken: "token sold",
  onBehalfOf: "on behalf of",
  recipient: "recipient",
  spender: "spender",
  amount: "amount",
};

/**
 * "dstReceiver" → "receiver of the swap"; a struct field is named by the field
 * alone when that is a word we know ("desc dstReceiver"), and otherwise with
 * its struct ("trade user").
 */
const humanise = (name: string): string => {
  const parts = name.split(" ");
  const last = parts[parts.length - 1];
  if (ARGUMENT_WORDS[last]) return ARGUMENT_WORDS[last];
  return parts.map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()).join(" ");
};

const functionSummary = (
  description: IPermissionDescription,
  ctx: SummaryContext,
): PermissionSummary | undefined => {
  const who = ctx.roleName(description.role);
  const target = description.target;
  const targetName = nameOf(target, ctx);
  const fn = ctx.functionName;
  const pins = collectPins(description);
  const args = argumentNames(ctx.inputs);
  const pinned = (index: number) => pinValues(pins, index, args[index]?.type);

  // ERC-20 transfer(to, amount)
  if (fn === "transfer" && args.length === 2) {
    const to = pinned(0);
    const cap = pinned(1);
    const lines: SummaryLine[] = [];
    if (cap && cap.kind === "below") lines.push([`Each transfer below ${cap.values[0]} (token units)`]);
    if (to && (to.kind === "equals" || to.kind === "oneOf")) {
      const count = to.values.length;
      return {
        headline: `${who} can send the vault's ${targetName} to ${count === 1 ? "one fixed address" : `${count} fixed addresses`}`,
        lines: [["Recipient: ", ...to.values.flatMap((v, i) => (i ? [" or ", valuePart(v)] : [valuePart(v)]))], ...lines],
      };
    }
    return { headline: `${who} can send ${targetName} to any address`, lines };
  }

  // ERC-20 approve(spender, amount)
  if (fn === "approve" && args.length === 2) {
    const spender = pinned(0);
    const cap = pinned(1);
    const lines: SummaryLine[] = [];
    if (cap && cap.kind === "below") lines.push([`Allowance below ${cap.values[0]} (token units)`]);
    if (spender && (spender.kind === "equals" || spender.kind === "oneOf")) {
      return {
        headline: `${who} can let ${spender.values.map((v) => valueName(v, ctx)).join(" or ")} spend the vault's ${targetName}`,
        // the spender is named in the headline; the line carries its address
        lines: [["Spender: ", ...spender.values.flatMap((v, i) => (i ? [" or ", valuePart(v)] : [valuePart(v)]))], ...lines],
      };
    }
    return { headline: `${who} can approve any spender for the vault's ${targetName}`, lines };
  }

  // Across depositV3Now(depositor, recipient, inputToken, outputToken,
  //   inputAmount, outputAmount, destinationChainId, exclusiveRelayer,
  //   fillDeadlineOffset, exclusivityDeadline, message)
  if (fn === "depositV3Now" || fn === "depositV3") {
    const chain = pinned(6);
    const destination = chain?.kind === "equals" ? chainName(chain.values[0]) : undefined;
    const input = pinned(2);
    const lines: SummaryLine[] = [];
    const from = pinned(0);
    const recipient = pinned(1);
    const output = pinned(3);
    const message = pinned(10);
    if (from?.kind === "equals") lines.push(["Sent from ", valuePart(from.values[0])]);
    if (recipient?.kind === "equals") {
      lines.push(["Received by ", valuePart(recipient.values[0]), destination ? ` on ${destination}` : ""]);
    } else {
      lines.push(["Received by any address"]);
    }
    if (output?.kind === "equals") lines.push(["Arrives as ", valuePart(output.values[0])]);
    if (message?.kind === "equals" && message.values[0] === "(empty)") {
      lines.push(["No instructions attached to the transfer"]);
    }
    const inputName = input?.kind === "equals" ? valueName(input.values[0], ctx) : "tokens";
    return {
      headline: `${who} can bridge ${inputName} with Across${destination ? ` to ${destination}` : ""}`,
      lines,
    };
  }

  // HyperCore CoreWriter sendRawAction(bytes)
  if (fn === "sendRawAction" || target?.toLowerCase() === CORE_WRITER) {
    const actions = pinned(0);
    if (actions && (actions.kind === "equals" || actions.kind === "oneOf")) {
      const raw = pins.get(0)?.values ?? [];
      // v1 keeps the bytes as-is; a v2 compValue for bytes is the same blob.
      const blobs = raw.map((value) => (value.startsWith("0x") ? value : "0x" + value));
      return {
        headline: `${who} can send HyperCore instructions, limited to ${raw.length === 1 ? "one fixed instruction" : `${raw.length} fixed ones`}`,
        lines: coreActionLines(blobs),
      };
    }
    return { headline: `${who} can send any HyperCore instruction`, lines: [] };
  }

  // Anything else: name the function and each restricted argument.
  const fnName = fn ?? unnamedFunction(description);
  const lines: SummaryLine[] = [];
  for (const [index, pin] of [...pins.entries()].sort(([a], [b]) => a - b)) {
    const name = humanise(args[index]?.name ?? `argument ${index + 1}`);
    lines.push(argumentLine(name, { kind: pin.kind, values: pin.values.map((v) => decodeValue(v, args[index]?.type)) }));
  }
  return {
    headline: `${who} can call ${fnName} on ${targetName}${lines.length ? ", with limits" : ""}`,
    lines,
  };
};

/** A function no ABI could name, by its selector. */
const unnamedFunction = (description: IPermissionDescription): string =>
  description.selector ? `function ${description.selector}` : "a function";

const executionCaution = (description: IPermissionDescription): string | undefined => {
  const option = description.executionOption ?? "";
  if (option.includes("delegatecall") && !option.startsWith("plain")) {
    return option.includes("ETH")
      ? "Can also send ETH and delegatecall — delegatecall runs code as the vault's Safe."
      : "Can also delegatecall — that runs code as the vault's Safe.";
  }
  if (option.includes("send ETH")) return "May also attach ETH to the call.";
  return undefined;
};

export const summarizePermission = (
  description: IPermissionDescription,
  ctx: SummaryContext,
): PermissionSummary | undefined => {
  const who = ctx.roleName(description.role);
  const targetName = nameOf(description.target, ctx);
  const fn = ctx.functionName;
  const caution = executionCaution(description);

  switch (description.action) {
    case "scope-function": {
      const summary = functionSummary(description, ctx);
      return summary
        ? { ...summary, caution: [summary.caution, caution].filter(Boolean).join(" ") || undefined }
        : undefined;
    }
    case "scope-parameter": {
      // Rewrites one argument's limit on a permission that already exists:
      // the new values replace the old ones, which is the part people miss.
      const summary = functionSummary(description, ctx);
      if (!summary) return undefined;
      return {
        ...summary,
        headline: `New limits: ${lowerFirst(summary.headline)}`,
        lines: [
          ...summary.lines,
          ["Replaces the previous list: anything not listed here is no longer allowed"],
        ],
      };
    }
    case "unscope-parameter":
      return {
        headline: `${who} can call ${fn ?? unnamedFunction(description)} on ${targetName} with one argument no longer limited`,
        lines: [],
      };
    case "allow-function":
      return {
        headline: `${who} can call ${fn ?? unnamedFunction(description)} on ${targetName} with any arguments`,
        lines: [],
        caution,
      };
    case "allow-target":
      return {
        headline: `${who} can call anything on ${targetName}`,
        lines: [["No limits on which function or arguments"]],
        caution,
      };
    case "scope-target": {
      // Opens the contract without allowing anything on it; the limits live
      // on the function calls that follow, so say which ones.
      const allowed = ctx.scopedFunctions ?? [];
      return {
        headline: `${who} gets access to ${targetName}, limited to functions allowed individually`,
        lines: allowed.length
          ? allowed.map((fn) => [`Only ${fn.name} is allowed on it; its limits are set in call ${fn.index + 1}`])
          : [["No function on it is allowed by this proposal; this call alone lets nothing through"]],
      };
    }
    case "revoke-target":
      return { headline: `${who} can no longer use ${targetName}`, lines: [] };
    case "revoke-function":
      return {
        headline: `${who} can no longer call ${fn ?? unnamedFunction(description)} on ${targetName}`,
        lines: [],
      };
    default:
      return undefined;
  }
};
