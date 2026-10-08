import { ethers } from "ethers";
import { networksMap } from "~/store/web3/networksMap";
import {
  formatCompValue,
  takesSlot,
  type IConditionNode,
  type IPermissionDescription,
} from "~/composables/proposal/describeProposalActions";
import { flattenAbiFunctionInputs } from "~/composables/zodiac-roles/flattenAbiFunctionInputs";
import { RolesV2Operator } from "~/composables/permissions/rolesV2Permissions";
import { CORE_USDC_SYSTEM, CORE_WRITER, WELL_KNOWN_LABELS } from "~/composables/contracts/contractNames";
import { describeCoreWriterRule } from "~/composables/permissions/coreWriterPatterns";

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
  /** A token's decimals, where known, so amounts read as amounts. */
  decimals?: (address: string) => number | undefined;
}

/* ---- Well-known contracts ------------------------------------------------ */

// The names live with the rest of the naming rules, so the store can use them too.
export { WELL_KNOWN_LABELS };

/** Decimals of tokens amounts keep being pinned in. Keyed by lowercase address. */
const WELL_KNOWN_DECIMALS: Record<string, number> = {
  "0xb88339cb7199b77e23db6e890353e22632ba630f": 6, // USDC on HyperEVM
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": 6, // USDC on Arbitrum
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 6, // USDC on Base
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 6, // USDC on Ethereum
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

type PinKind = "equals" | "oneOf" | "below" | "above" | "safe" | "other";

interface Pin {
  kind: PinKind;
  /** Raw comparison values (abi-encoded), decoded on use. */
  values: string[];
}

/** The restrictions on each argument, by argument index. */
type Pins = Map<number, Pin>;

interface ArgumentRules {
  /** What holds on every call. */
  pins: Pins;
  /**
   * Argument combinations of which one must hold, as in "this amount in and
   * at least that much out, or that amount and …". Absent when there are none.
   */
  combinations?: Pins[];
  /** Whether the rule could be read argument by argument at all. */
  readable: boolean;
}

/** One calldata match's restrictions, by argument index. */
const pinsOf = (match: IConditionNode): Pins => {
  const pins: Pins = new Map();
  match.children.forEach((child: IConditionNode, index: number) => {
    const pin = v2Pin(child);
    if (pin) pins.set(index, pin);
  });
  return pins;
};

/**
 * A condition that takes no argument's slot, such as a budget on the call
 * itself (the ETH it sends, the number of calls). Read argument by argument
 * it would be dropped or pinned on the wrong argument.
 */
const isCallLevel = (node: IConditionNode) => !takesSlot(node);

/**
 * A v2 rule read argument by argument. Its root is a calldata match, or an
 * "all of" group of them (whose restrictions all hold), which may also hold
 * one "any of" group of matches: the allowed combinations. Any other shape
 * is not readable here and is left to the exact rule.
 */
const readArguments = (root: IConditionNode): ArgumentRules => {
  const rules: ArgumentRules = { pins: new Map(), readable: true };
  const visit = (node: IConditionNode) => {
    if (node.children.some(isCallLevel)) {
      rules.readable = false;
      return;
    }
    if (node.operator === RolesV2Operator.Matches) {
      for (const [index, pin] of pinsOf(node)) rules.pins.set(index, pin);
    } else if (node.operator === RolesV2Operator.And) {
      node.children.forEach(visit);
    } else if (
      node !== root &&
      node.operator === RolesV2Operator.Or &&
      !rules.combinations &&
      node.children.every(
        (child) => child.operator === RolesV2Operator.Matches && !child.children.some(isCallLevel),
      )
    ) {
      rules.combinations = node.children.map(pinsOf);
    } else {
      rules.readable = false;
    }
  };
  visit(root);
  return rules;
};

/**
 * Each argument's restrictions. v1 states them per index; v2 as calldata
 * matches whose children are the arguments (see readArguments). Anything
 * nested deeper than one comparison per argument is reported as "other" and
 * left to the exact rule.
 */
const collectPins = (description: IPermissionDescription): ArgumentRules => {
  if (description.conditions) return readArguments(description.conditions);
  const pins: Pins = new Map();
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
  return { pins, readable: true };
};

const v2Pin = (node: IConditionNode): Pin | undefined => {
  switch (node.operator) {
    case RolesV2Operator.Pass:
      return undefined;
    case RolesV2Operator.EqualTo:
      return { kind: "equals", values: [node.compValue] };
    case RolesV2Operator.EqualToAvatar:
      return { kind: "safe", values: [] };
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
    case "safe":
      return [`${capitalise(name)}: only the vault's Safe`];
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

/**
 * An address argument as "<prefix> <who>": a fixed address, the vault's Safe,
 * a list, or, for anything else, a pointer to the exact rule. Undefined when
 * the argument is not restricted.
 */
const partyLine = (
  prefix: string,
  pin: { kind: PinKind; values: string[] } | undefined,
  suffix = "",
): SummaryLine | undefined => {
  if (!pin) return undefined;
  const values = pin.values.map(valuePart);
  const tail = suffix ? [suffix] : [];
  switch (pin.kind) {
    case "equals":
      return [`${prefix} `, values[0], ...tail];
    case "safe":
      return [`${prefix} the vault's Safe${suffix}`];
    case "oneOf":
      return [
        `${prefix} one of `,
        ...values.flatMap((value, i) => (i ? [i === values.length - 1 ? " or " : ", ", value] : [value])),
        ...tail,
      ];
    default:
      return [`${prefix}: restricted (see the exact rule)`];
  }
};

/** Every restricted argument outside `covered`, said generically, in order. */
const remainingLines = (
  pins: Map<number, Pin>,
  args: { name: string; type?: ethers.ParamType }[],
  covered: number[],
): SummaryLine[] =>
  [...pins.entries()]
    .filter(([index]) => !covered.includes(index))
    .sort(([a], [b]) => a - b)
    .map(([index, pin]) =>
      argumentLine(humanise(args[index]?.name ?? `argument ${index + 1}`), {
        kind: pin.kind,
        values: pin.values.map((v) => decodeValue(v, args[index]?.type)),
      }),
    );

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

/** A raw comparison value that is zero: 0, the zero address, empty bytes. */
const isZero = (value: string): boolean => {
  if (!value || value === "0x") return true;
  try {
    return BigInt(value) === 0n;
  } catch {
    return false;
  }
};

const decimalsOf = (address: string | undefined, ctx: SummaryContext): number | undefined =>
  address && isAddress(address)
    ? ctx.decimals?.(address) ?? WELL_KNOWN_DECIMALS[address.toLowerCase()]
    : undefined;

/** A raw token amount as the token counts it, or in token units when its decimals are unknown. */
const formatAmount = (amount: bigint, decimals?: number): string =>
  decimals === undefined
    ? `${amount.toLocaleString("en-US")} (token units)`
    : Number(ethers.formatUnits(amount, decimals)).toLocaleString("en-US", {
      maximumFractionDigits: decimals,
    });

/**
 * "50,000 sent", "at least 49,974.75 received": an amount restriction in
 * words. "Greater than x" reads as "at least x + 1 unit", which is what it
 * means for an integer and what people expect to see.
 */
const amountText = (pin: Pin | undefined, decimals: number | undefined, verb: string): string => {
  if (!pin) return "";
  let raw: bigint;
  try {
    raw = BigInt(pin.values[0]);
  } catch {
    return `${verb}: restricted (see the exact rule)`;
  }
  switch (pin.kind) {
    case "equals":
      return `${formatAmount(raw, decimals)} ${verb}`;
    case "above":
      return `at least ${formatAmount(raw + 1n, decimals)} ${verb}`;
    case "below":
      return `at most ${formatAmount(raw - 1n, decimals)} ${verb}`;
    default:
      return `${verb}: restricted (see the exact rule)`;
  }
};

/** Allowed argument combinations, one per line, for functions with no words of their own. */
const combinationLines = (
  combinations: Pins[],
  args: { name: string; type?: ethers.ParamType }[],
): SummaryLine[] => [
  [`One of these ${combinations.length} combinations:`],
  ...combinations.map((combination) =>
    remainingLines(combination, args, []).flatMap((line, i) => (i ? ["; ", ...line] : line)),
  ),
];

const functionSummary = (
  description: IPermissionDescription,
  ctx: SummaryContext,
): PermissionSummary | undefined => {
  const who = ctx.roleName(description.role);
  const target = description.target;
  const targetName = nameOf(target, ctx);
  const fn = ctx.functionName;
  const rules = collectPins(description);
  const { pins, combinations } = rules;
  const args = argumentNames(ctx.inputs);
  const pinned = (index: number) => pinValues(pins, index, args[index]?.type);
  const isAcross = fn === "depositV3Now" || fn === "depositV3";

  // A rule not shaped argument by argument cannot be summarised: saying
  // less than it does ("received by any address") would be wrong, so point
  // at the exact rule instead.
  if (!rules.readable) {
    return {
      headline: `${who} can call ${fn ?? unnamedFunction(description)} on ${targetName}, with limits`,
      lines: [["Limits: see the exact rule"]],
    };
  }

  // ERC-20 transfer(to, amount)
  if (!combinations && fn === "transfer" && args.length === 2) {
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
  if (!combinations && fn === "approve" && args.length === 2) {
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
  if (isAcross) {
    const chain = pinned(6);
    const destination = chain?.kind === "equals" ? chainName(chain.values[0]) : undefined;
    const input = pinned(2);
    const lines: SummaryLine[] = [];
    const from = pinned(0);
    const recipient = pinned(1);
    const output = pinned(3);
    const message = pinned(10);
    // Each argument is said exactly once: the ones a bridge is about in its
    // own words, and every other restricted one generically after them, so a
    // limit is never dropped from the list.
    const covered = [0, 1, 6];
    const fromLine = partyLine("Sent from", from);
    if (fromLine) lines.push(fromLine);
    lines.push(
      partyLine("Received by", recipient, destination ? ` on ${destination}` : "") ??
        [`Received by any address${destination ? ` on ${destination}` : ""}`],
    );
    if (chain && chain.kind === "oneOf") {
      lines.push([`Destination: ${chain.values.map(chainName).join(" or ")}`]);
    } else if (chain && chain.kind !== "equals") {
      covered.pop();
    }
    if (input?.kind === "equals" || input?.kind === "oneOf") {
      lines.push(partyLine("Sends", input)!);
      covered.push(2);
    }
    if (output?.kind === "equals" || output?.kind === "oneOf") {
      lines.push(partyLine("Arrives as", output)!);
      covered.push(3);
    }
    if (message?.kind === "equals" && isZero(pins.get(10)!.values[0])) {
      lines.push(["No instructions attached to the transfer"]);
      covered.push(10);
    }
    if (pins.get(7)?.kind === "equals" && isZero(pins.get(7)!.values[0])) {
      lines.push(["No exclusive relayer: any relayer may fill it"]);
      covered.push(7);
    }
    if (pins.get(9)?.kind === "equals" && isZero(pins.get(9)!.values[0])) {
      lines.push(["No exclusivity period"]);
      covered.push(9);
    }
    lines.push(...remainingLines(pins, args, covered));

    // The allowed amounts: what is sent, and at least what has to arrive.
    if (combinations?.every((combination) => [...combination.keys()].every((i) => i === 4 || i === 5))) {
      const sentDecimals = decimalsOf(input?.kind === "equals" ? input.values[0] : undefined, ctx);
      const receivedDecimals = decimalsOf(output?.kind === "equals" ? output.values[0] : undefined, ctx);
      lines.push([`Amount: one of ${combinations.length} fixed amounts`]);
      for (const combination of combinations) {
        const sent = amountText(combination.get(4), sentDecimals, "sent");
        const received = amountText(combination.get(5), receivedDecimals, "received");
        lines.push([[sent, received].filter(Boolean).join(", ")]);
      }
    } else if (combinations) {
      lines.push(...combinationLines(combinations, args));
    }

    const inputName = input?.kind === "equals" ? valueName(input.values[0], ctx) : "tokens";
    return {
      headline: `${who} can bridge ${inputName} with Across${destination ? ` to ${destination}` : ""}`,
      // Nothing restricted at all: there are no limits to list.
      lines: pins.size || combinations ? lines : [],
    };
  }

  // HyperCore CoreWriter sendRawAction(bytes)
  if (!combinations && (fn === "sendRawAction" || target?.toLowerCase() === CORE_WRITER)) {
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
    if (pins.has(0)) {
      // A Roles v2 rule of byte checks on the instruction rather than a list
      // of fixed instructions: read back which instructions it lets through.
      // Never "any instruction": the rule does limit them.
      const kinds = describeCoreWriterRule(description.conditions);
      return kinds
        ? {
          headline: `${who} can send HyperCore instructions, limited to ${kinds.length === 1 ? "one kind" : `${kinds.length} kinds`}`,
          lines: kinds,
        }
        : {
          headline: `${who} can send HyperCore instructions, with limits`,
          lines: [["Limits: see the exact rule"]],
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
  if (combinations) lines.push(...combinationLines(combinations, args));
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
