import { ethers } from "ethers";
import {
  PACKAGE_VERSION,
  compile,
  deriveReplaceCalls,
  getProtocolEntry,
  listProtocols,
  validateSelections,
  type ProtocolDescriptor,
  type Selection,
} from "@rethink-finance/positions-registry";
import { DEFAULT_ROLE_KEY_V2 } from "~/composables/nav/generateNAVPermission";
import type { IPermissionScope } from "~/composables/permissions/revokePermissions";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Bridge between the create flow's Permissions step and
 * @rethink-finance/positions-registry, the reviewed package that turns
 * protocol/action/asset selections into Zodiac Roles v2 permissions.
 *
 * Division of labour (see the package's SCHEMA.md and INTEGRATION.md):
 * the registry's zod schemas are the single source of truth for what the UI
 * may offer — this module only INTROSPECTS them into renderable field
 * descriptors and passes selected values back verbatim. No permission JSON
 * is ever constructed or edited here; compile() and deriveReplaceCalls()
 * produce everything that reaches the chain.
 */

/**
 * Schema fields the registry documents as reserved: validated, but ignored
 * by its generators, so rendering a control for them would promise
 * enforcement that does not happen (SCHEMA.md, "Reserved fields"). Remove a
 * key only when the registry documents the field as implemented.
 *
 * `cap` is the singular form Spark's stake schema uses — that action holds a
 * single position, so it reserves one amount instead of the per-target
 * `caps` record ("RESERVED (charter decision #6) … IGNORED in v1" in its own
 * doc comment). NOTE this list is the frontend's copy of a registry fact and
 * it fails OPEN: a reserved field whose name is not listed here renders as a
 * live control promising enforcement that never happens. The registry should
 * mark reserved fields in the schema itself (or export the list) so this
 * cannot drift — see the integration notes.
 */
const RESERVED_SCHEMA_FIELDS = new Set(["caps", "cap"]);

const PROTOCOL_LABELS: Record<string, string> = {
  aave_v3: "Aave v3",
  spark: "Spark",
  compound_v3: "Compound v3",
};

const ACTION_LABELS: Record<string, string> = {
  deposit: "Deposit",
  borrow: "Borrow",
  stake: "Stake",
  swap: "Swap",
  lock: "Lock",
  delegate: "Delegate",
};

/**
 * What an action grants, in the creator's terms. Looked up as
 * "<protocol>.<action>" first, then by bare action: the generic entries
 * describe the lending-market shape every protocol so far follows, and a
 * protocol overrides one only where its own semantics differ (a Spark
 * deposit reaching savings clusters, a Compound market picking its own
 * borrow asset).
 */
const ACTION_HINTS: Record<string, string> = {
  deposit:
    "Supply the selected assets, withdraw them back to the vault Safe, and " +
    "toggle them as collateral. Deposits and withdrawals are pinned to pay " +
    "out only to the Safe.",
  borrow:
    "Borrow the selected assets against the vault's collateral and repay " +
    "the debt. Borrowed funds are pinned to pay out only to the Safe.",
  stake:
    "Stake the selected assets, claim rewards, and unstake them back to " +
    "the vault Safe. Payouts are pinned to the Safe.",
  delegate:
    "Delegate the governance voting power of the selected tokens to the " +
    "delegatee address. Only voting power moves — never the tokens.",

  "spark.deposit":
    "Supply and withdraw SparkLend reserves, and move funds through the Sky " +
    "savings vaults. The DSR_ and SKY_ targets are not tokens: each one " +
    "stands for a savings cluster. Payouts are pinned to the vault Safe.",
  "spark.stake":
    "Sky's “stake USDS, earn SKY” farm. There is nothing to choose here — " +
    "enabling this grants staking, reward claiming and unstaking on that " +
    "one farm, paid out to the vault Safe.",
  "compound_v3.deposit":
    "Supply and withdraw assets on the selected Compound v3 markets, and " +
    "claim COMP rewards. Each market is its own contract with its own base " +
    "asset and collateral set. Payouts are pinned to the vault Safe.",
  "compound_v3.borrow":
    "Borrow the selected asset and repay it. A Compound v3 market only " +
    "lends its own base asset, so choosing the asset chooses the market.",
};

/**
 * Cautions the registry's schema notes attach to an action, shown alongside
 * its controls (not tucked into the advanced panel). Same
 * "<protocol>.<action>" then bare-action lookup as the hints.
 *
 * Delegation: the registry pins the permission to exactly the delegatee
 * entered, but WHICH address is the creator's free choice, so the schema
 * marks the action governance-sensitive and asks the frontend to present it
 * accordingly. Spark deposit: the schema documents each savings target as
 * expanding to a whole contract cluster — vault plus PSM/migration wrappers
 * — so one chip grants more than the one vault it names.
 */
const ACTION_WARNINGS: Record<string, string> = {
  delegate:
    "Governance-sensitive: the permission pins delegation to exactly the " +
    "delegatee address entered here, but that address is your own choice — " +
    "the registry cannot vet it. Verify it before granting.",
  "spark.deposit":
    "Each DSR_ and SKY_ target grants a cluster of contracts, not a single " +
    "vault — including Sky's PSM wrappers, which convert between the " +
    "cluster's assets (USDC↔sDAI, USDC↔sUSDS). Check the generated calls " +
    "listed under the card before granting.",
};

/**
 * Control labels, looked up as "<protocol>.<action>.<field>" then by bare
 * field name. `targets` is the registry's name for "what this action acts
 * on", which is assets for a lending pool but MARKETS for Compound v3 —
 * where the assets are the separate `tokens` field. Labelling both "Assets"
 * would misdescribe what is being granted.
 */
const FIELD_LABELS: Record<string, string> = {
  targets: "Assets",
  "compound_v3.deposit.targets": "Markets",
  "compound_v3.deposit.tokens": "Assets",
};

const getFieldLabel = (
  key: string,
  protocol?: string,
  action?: string,
): string =>
  (protocol && action ? FIELD_LABELS[`${protocol}.${action}.${key}`] : undefined) ??
  FIELD_LABELS[key] ??
  prettifyKey(key);

/** "aave_v3" → "Aave v3" for protocols the label map does not list yet. */
const prettifyKey = (key: string): string =>
  key
    .split(/[_-]/)
    .map((part) => (/^v\d+$/i.test(part)
      ? part.toLowerCase()
      : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");

export const getProtocolLabel = (protocol: string): string =>
  PROTOCOL_LABELS[protocol] ?? prettifyKey(protocol);

export const getActionLabel = (action: string): string =>
  ACTION_LABELS[action] ?? prettifyKey(action);

/** Protocol-specific copy wins; the bare action is the shared default. */
const lookupActionCopy = (
  table: Record<string, string>,
  action: string,
  protocol?: string,
): string =>
  (protocol ? table[`${protocol}.${action}`] : undefined) ??
  table[action] ??
  "";

export const getActionHint = (action: string, protocol?: string): string =>
  lookupActionCopy(ACTION_HINTS, action, protocol);

export const getActionWarning = (action: string, protocol?: string): string =>
  lookupActionCopy(ACTION_WARNINGS, action, protocol);

/** The registry keys chains by number; the app's ChainId is a hex string. */
export const toRegistryChainId = (chainId: ChainId | string): number =>
  Number(chainId);

/**
 * Protocol and token marks come from DefiLlama's icon service
 * (github.com/DefiLlama/icons): protocols by slug, tokens by chain id +
 * address. Both URL shapes are derived, so a protocol or reserve the
 * registry adds tomorrow gets its mark with no frontend change; a broken or
 * missing mark falls back in the components that render these URLs.
 */
const LLAMA_PROTOCOL_ICON_BASE = "https://icons.llamao.fi/icons/protocols";
const LLAMA_TOKEN_ICON_BASE = "https://token-icons.llamao.fi/icons/tokens";

/** Registry protocol key → DefiLlama slug where the two differ. */
const PROTOCOL_LLAMA_SLUGS: Record<string, string> = {
  aave_v3: "aave-v3",
};

export const getProtocolLogoUrl = (protocol: string): string => {
  // DefiLlama slugs are the dashed form of the protocol name, which is what
  // the registry's underscored keys map onto for every protocol so far.
  const slug = PROTOCOL_LLAMA_SLUGS[protocol] ?? protocol.replace(/_/g, "-");
  return `${LLAMA_PROTOCOL_ICON_BASE}/${slug}?w=48&h=48`;
};

/** DefiLlama serves the chain's native-asset mark at the zero address. */
const NATIVE_TOKEN_PSEUDO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

export const getTokenLogoUrl = (
  chainId: ChainId | string,
  tokenAddress?: string,
): string | undefined => {
  const numericChainId = toRegistryChainId(chainId);
  if (!Number.isFinite(numericChainId) || numericChainId <= 0) {
    return undefined;
  }
  const address = (tokenAddress || NATIVE_TOKEN_PSEUDO_ADDRESS).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return undefined;
  return `${LLAMA_TOKEN_ICON_BASE}/${numericChainId}/${address}?h=48&w=48`;
};

export interface IProtocolParamOption {
  /** Exact schema enum value — submitted verbatim, never rebuilt. */
  value: string;
  label: string;
  /**
   * Address the protocol's data tables pair with this value (a token for
   * assets, a pool for markets), when one resolves. Feeds the icon lookup.
   */
  tokenAddress?: string;
}

export type ProtocolParamControl =
  | "multi-select"
  | "single-select"
  | "text"
  | "unsupported";

export interface IProtocolParamField {
  key: string;
  label: string;
  control: ProtocolParamControl;
  optional: boolean;
  /** For the select controls. */
  options?: IProtocolParamOption[];
  /** For text controls carrying a zod regex check. */
  pattern?: string;
  /** Shown under the control; empty when there is nothing to say. */
  note?: string;
  /**
   * The value the schema itself declares for an untouched field. Scalars
   * only: an array default would seed a GRANT nobody asked for, which is
   * not a default this form is willing to apply on someone's behalf.
   */
  defaultValue?: string;
}

/**
 * What an untouched optional field means, said out loud. An empty
 * multi-select reads as "nothing granted" — but the frontend omits an unset
 * optional key (SCHEMA.md), and a generator's default for an absent key can
 * be far WIDER than any selection: Compound v3's `tokens` narrows the chosen
 * markets, so leaving it empty grants every asset of each. Stated in terms
 * of what this form does, not of one generator's default, because the next
 * optional field may default the other way.
 */
export const OPTIONAL_FIELD_NOTE =
  "Optional — selecting nothing omits this setting entirely and lets the " +
  "registry apply the action's own default, which may be broader than a " +
  "narrowed selection. The generated calls listed under the card say what " +
  "it actually grants.";

/**
 * A required multi-select IS its action's grant: the action allows exactly
 * what is picked here, so picking nothing means the action is not granted
 * at all rather than "granted over nothing". Everything else — an optional
 * narrowing, a market, a delegatee — only shapes an action granted by one
 * of these, which is why emptying one of those must never switch an action
 * off. `normalizeActionEnablement` keeps the stored flag in step.
 */
const isGoverningField = (field: IProtocolParamField): boolean =>
  field.control === "multi-select" && !field.optional;

export interface IProtocolActionDescriptor {
  action: string;
  label: string;
  hint: string;
  /** Registry-documented caution for this action; empty when there is none. */
  warning: string;
  fields: IProtocolParamField[];
}

/**
 * One control shared by several actions. Picking an asset once and letting
 * the per-asset action toggles decide what it is used FOR beats asking
 * for the same asset twice: Aave's deposit and borrow offer the identical 67
 * assets, and Compound's 6 borrowable assets are 6 of its 33 depositable
 * ones, so a per-action control makes the creator restate the same choice.
 */
export interface IProtocolFieldGroupOption extends IProtocolParamOption {
  /**
   * The group's actions that accept this value. A proper subset when the
   * merged schemas disagree — Spark's savings clusters are depositable but
   * not borrowable — which is what the chip advertises.
   */
  actions: string[];
}

/** One action's field inside a group; the group writes each separately. */
export interface IProtocolFieldGroupMember {
  action: string;
  /** Schema field key IN THAT ACTION — merged fields may differ by key. */
  key: string;
  values: string[];
  optional: boolean;
  /** The schema's own default, when it declares one (see `schemaDefault`). */
  defaultValue?: string;
}

export interface IProtocolFieldGroup {
  id: string;
  /** Where this control's actions live, for generator-narrowing probes. */
  chainId: number;
  protocol: string;
  label: string;
  /**
   * Singular noun for what one option IS, kept apart from `label` because a
   * group can be named after its action ("Delegate") while still choosing
   * assets — "select at least one delegate" is not a sentence.
   */
  noun: string;
  control: ProtocolParamControl;
  options?: IProtocolFieldGroupOption[];
  pattern?: string;
  note?: string;
  /** Caution from a member action, shown against this control. */
  warning?: string;
  members: IProtocolFieldGroupMember[];
}

export interface IProtocolDescriptor {
  chainId: number;
  protocol: string;
  label: string;
  actions: IProtocolActionDescriptor[];
  /** The rendered controls: actions' fields, merged where they coincide. */
  groups: IProtocolFieldGroup[];
  /** Lowercased address → human name, for the generated-calls preview. */
  addressLabels: Record<string, string>;
}

/**
 * The members of a control whose values decide whether their action is
 * granted at all (see `isGoverningField`). A group holding any of them is a
 * grant in itself: leaving it empty is a choice — those actions are simply
 * not granted — never a form error.
 */
export const governingMembers = (
  group: IProtocolFieldGroup,
): IProtocolFieldGroupMember[] =>
  group.control === "multi-select"
    ? group.members.filter((member) => !member.optional)
    : [];

/**
 * Zod internals are read by duck-typing on `_def.typeName` instead of
 * importing zod: the schemas come from the registry's own zod instance, and
 * matching on structure keeps this file working even when the frontend tree
 * carries a second zod copy.
 */
const zodDef = (schema: any): any => schema?._def ?? {};

const unwrapSchema = (schema: any): any => {
  let current = schema;
  // Optional/Default/Effects only wrap; the control derives from the core.
  for (;;) {
    const def = zodDef(current);
    if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault") {
      current = def.innerType;
    } else if (def.typeName === "ZodEffects") {
      current = def.schema;
    } else {
      return current;
    }
  }
};

const isAddressLike = (value: string): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(value);

/**
 * One name↔address pair a protocol entry's schema enums alias (a reserve,
 * a stake or delegate target, a market…). Sourced from the registry's
 * first-class alias table (`entry.aliases`, registry ≥ b8bbc9b) or, for
 * older registry versions, from the legacy shape scan of `entry.data`.
 */
interface IAliasRow {
  /** Human-readable name (the enum's non-address spelling). */
  symbol: string;
  /** The 0x address the registry's schema enums pair that name with. */
  address: string;
}

/**
 * Reads the entry's first-class alias table (SCHEMA.md, "The alias
 * table"): explicit `{name, address?, kind}` rows, guaranteed by a
 * registry unit test to cover every schema enum value. Rows without an
 * address ("native"/"savings" pseudo-targets) carry no alias pairing and
 * are skipped — dedup and labelling only ever key on addresses. Returns
 * undefined when the installed registry predates the table, so the caller
 * can fall back to the shape scan; an existing-but-sparse table is
 * authoritative, not a reason to fall back.
 */
const readEntryAliasTable = (entry: unknown): IAliasRow[] | undefined => {
  const aliases = (entry as { aliases?: unknown } | undefined)?.aliases;
  if (!Array.isArray(aliases)) return undefined;
  const rows: IAliasRow[] = [];
  for (const alias of aliases) {
    if (!alias || typeof alias !== "object") continue;
    const { name, address } = alias as { name?: unknown; address?: unknown };
    if (typeof name !== "string" || name === "") continue;
    if (typeof address !== "string" || !isAddressLike(address)) continue;
    rows.push({ symbol: name, address });
  }
  return rows;
};

/**
 * The key pairings the registry builds its schema enums from: each table row
 * carries one name-ish key and one primary address-ish key — {symbol, token}
 * for reserves and delegate targets, {symbol, underlying} for stake targets,
 * {name, pool} for markets. Secondary addresses on the same row
 * (aTokenAddress, stakedToken, gateways…) are different contracts, not
 * aliases of the name, so only the first matching address key counts.
 */
const ALIAS_NAME_KEYS = ["symbol", "name"];
const ALIAS_ADDRESS_KEYS = ["token", "underlying", "pool", "address"];

const readAliasRow = (row: unknown): IAliasRow | undefined => {
  if (!row || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;
  const name = ALIAS_NAME_KEYS.map((key) => record[key]).find(
    (value): value is string =>
      typeof value === "string" && value !== "" && !isAddressLike(value),
  );
  const address = ALIAS_ADDRESS_KEYS.map((key) => record[key]).find(
    (value): value is string =>
      typeof value === "string" && isAddressLike(value),
  );
  return name && address ? { symbol: name, address } : undefined;
};

/**
 * LEGACY FALLBACK for registry versions without `entry.aliases`: a
 * best-effort shape scan of the entry's checked-in data tables for the
 * name↔address pairs its schema enums alias. The whole `data` object is
 * walked: arrays row by row, objects by their values (eth's `markets` keys
 * its rows by market name), and nested values recursively, because a table
 * row can itself hold the rows another enum aliases (a Compound comet nests
 * its base and collateral tokens). Rows are recognised purely by shape, so
 * no table, field or protocol is special-cased — which is exactly why the
 * first-class alias table supersedes this: a table with a different key
 * pairing would be silently missed here. Kept only until every deployed
 * registry version ships `entry.aliases`.
 */
/** Depth bound so a pathological data shape cannot walk forever. */
const MAX_ALIAS_SCAN_DEPTH = 6;

const collectAliasRows = (
  node: unknown,
  depth: number,
  rows: IAliasRow[],
): void => {
  if (!node || typeof node !== "object" || depth > MAX_ALIAS_SCAN_DEPTH) return;
  if (Array.isArray(node)) {
    for (const item of node) collectAliasRows(item, depth + 1, rows);
    return;
  }
  const row = readAliasRow(node);
  if (row) rows.push(row);
  // Recurse even when the node itself is a row: Compound's comet rows pair
  // their own symbol with their market address AND nest the token rows the
  // `tokens` enum aliases (borrowToken, collateralTokens[]).
  for (const value of Object.values(node)) {
    collectAliasRows(value, depth + 1, rows);
  }
};

const readAliasRows = (data: unknown): IAliasRow[] => {
  const rows: IAliasRow[] = [];
  collectAliasRows(data, 0, rows);
  return rows;
};

/**
 * Enum values → options. The registry's enums list every entry twice — once
 * as a name and once as its paired address (SCHEMA.md: aliases for
 * programmatic callers). Only the address values that are provably aliases
 * of a listed name are dropped; an address without a name twin stays —
 * labelled by its table name when one is known, shortened otherwise —
 * rather than silently vanishing from the UI.
 */
const buildEnumOptions = (
  values: string[],
  aliasRows: IAliasRow[],
): IProtocolParamOption[] => {
  const addressBySymbol = new Map<string, string>();
  const symbolsByAddress = new Map<string, string[]>();
  for (const row of aliasRows) {
    if (!addressBySymbol.has(row.symbol)) {
      addressBySymbol.set(row.symbol, row.address);
    }
    const key = row.address.toLowerCase();
    const symbols = symbolsByAddress.get(key) ?? [];
    if (!symbols.includes(row.symbol)) {
      symbolsByAddress.set(key, [...symbols, row.symbol]);
    }
  }
  const symbolValues = new Set(values.filter((value) => !isAddressLike(value)));

  const options: IProtocolParamOption[] = [];
  for (const value of values) {
    if (isAddressLike(value)) {
      const aliasSymbols = symbolsByAddress.get(value.toLowerCase()) ?? [];
      if (aliasSymbols.some((symbol) => symbolValues.has(symbol))) continue;
      options.push({
        value,
        label: aliasSymbols[0] ?? `${value.slice(0, 6)}…${value.slice(-4)}`,
        tokenAddress: value,
      });
      continue;
    }
    options.push({
      value,
      label: value,
      tokenAddress: addressBySymbol.get(value),
    });
  }
  return options;
};

/**
 * The value a schema declares for an untouched field, when it declares one.
 * `market` is ZodDefault("Core"): the registry has already decided what an
 * unstated market means, and reading it here is what lets the form open on
 * that answer instead of on "Market is required".
 */
const schemaDefault = (schema: any): string | undefined => {
  let current = schema;
  for (;;) {
    const def = zodDef(current);
    if (def.typeName === "ZodDefault") {
      const value = def.defaultValue?.();
      return typeof value === "string" ? value : undefined;
    }
    if (def.typeName === "ZodOptional") current = def.innerType;
    else if (def.typeName === "ZodEffects") current = def.schema;
    else return undefined;
  }
};

const buildParamField = (
  key: string,
  schema: any,
  aliasRows: IAliasRow[],
  protocol?: string,
  action?: string,
): IProtocolParamField => {
  const optional = zodDef(schema).typeName === "ZodOptional";
  const core = unwrapSchema(schema);
  const def = zodDef(core);
  const declared = schemaDefault(schema);
  const base = {
    key,
    label: getFieldLabel(key, protocol, action),
    optional,
    ...(declared === undefined ? {} : { defaultValue: declared }),
    ...(optional ? { note: OPTIONAL_FIELD_NOTE } : {}),
  };

  if (def.typeName === "ZodArray") {
    const elementDef = zodDef(unwrapSchema(def.type));
    if (elementDef.typeName === "ZodEnum") {
      return {
        ...base,
        control: "multi-select",
        options: buildEnumOptions([...elementDef.values], aliasRows),
      };
    }
  }
  if (def.typeName === "ZodEnum") {
    return {
      ...base,
      control: "single-select",
      options: buildEnumOptions([...def.values], aliasRows),
    };
  }
  if (def.typeName === "ZodString") {
    const regexCheck = (def.checks ?? []).find(
      (check: any) => check.kind === "regex",
    );
    return {
      ...base,
      control: "text",
      pattern: regexCheck?.regex?.source,
    };
  }

  // A schema shape this renderer does not know. Surfaced as a visible row
  // rather than skipped: SCHEMA.md forbids silently dropping fields, and a
  // loud gap is what gets the renderer extended when the registry grows.
  return { ...base, control: "unsupported" };
};

/**
 * Actions whose controls may merge with each other, and the rule each family
 * merges under. Deliberately a short allow-list of named families rather
 * than a deny-list: an action the registry adds tomorrow gets its own
 * section until someone decides it belongs in a shared picker, so the
 * conservative outcome (one more visible control) is the default and
 * widening is always an explicit, reviewed choice.
 *
 * Lending merges on NESTING, because same-named fields can be different
 * things: Compound's deposit `targets` are markets while its borrow
 * `targets` are assets, and merging those would put comets and tokens in
 * one picker.
 *
 * Staking and delegation merge on OVERLAP. They are one concern — what the
 * vault may do with a handful of governance-ish tokens — over sets that
 * share AAVE, which today has to be picked twice in two near-identical
 * three-chip controls. Each token carries only the scopes it actually
 * accepts (ABPTV2 stakes but cannot be delegated, stkAAVE the reverse), so
 * the merge never offers a value to an action that would reject it. A
 * shared value is still required: sets that touch nowhere are two different
 * choices and keep their own controls.
 */
interface IMergeFamily {
  actions: Set<string>;
  match: "nested" | "overlapping";
  /** Names a control the family's actions ended up sharing. */
  label?: string;
  noun?: string;
  /**
   * A side errand rather than the protocol's main business: the card keeps
   * these behind a disclosure so a lending vault is not asked about
   * governance before it has picked an asset.
   */
  secondary?: boolean;
}

const MERGE_FAMILIES: IMergeFamily[] = [
  { actions: new Set(["deposit", "borrow"]), match: "nested" },
  {
    actions: new Set(["stake", "delegate"]),
    match: "overlapping",
    label: "Stake & delegate",
    noun: "token",
    secondary: true,
  },
];

const familyOf = (action: string): IMergeFamily | undefined =>
  MERGE_FAMILIES.find((family) => family.actions.has(action));

/** An action the card keeps behind a disclosure (staking, delegation). */
export const isSecondaryAction = (action: string): boolean =>
  familyOf(action)?.secondary === true;

/**
 * A control that belongs behind the disclosure: every action reading it is
 * a side errand. A control shared with a primary action stays in the open —
 * hiding an asset picker that deposits reads on would hide the main flow.
 */
export const isSecondaryGroup = (group: IProtocolFieldGroup): boolean =>
  group.members.length > 0 &&
  group.members.every((member) => isSecondaryAction(member.action));

const isSubset = (inner: string[], outer: Set<string>): boolean =>
  inner.every((value) => outer.has(value));

/** "Assets" → "asset", for messages that count what a control holds. */
const singularize = (label: string): string =>
  label.toLowerCase().replace(/s$/, "");

/**
 * Two fields describe the same choice when they render the same control over
 * option sets related the way their family merges: NESTED (one contained in
 * the other, so their union offers nothing neither action would accept) or
 * merely OVERLAPPING. Either way the union never reaches an action that
 * rejects it — each option records which members accept it — so the rule is
 * about what reads as one question, not about safety.
 */
const fieldsDescribeSameChoice = (
  group: IProtocolFieldGroup,
  field: IProtocolParamField,
  match: IMergeFamily["match"],
): boolean => {
  if (group.control !== field.control) return false;
  if (field.control === "unsupported") return false;
  if (field.control === "text") return group.pattern === field.pattern;

  const groupValues = new Set((group.options ?? []).map((o) => o.value));
  const fieldValues = (field.options ?? []).map((o) => o.value);
  if (!groupValues.size || !fieldValues.length) return false;
  if (match === "overlapping") {
    return fieldValues.some((value) => groupValues.has(value));
  }
  return (
    isSubset(fieldValues, groupValues) ||
    isSubset([...groupValues], new Set(fieldValues))
  );
};

const widestMemberSize = (group: IProtocolFieldGroup): number =>
  group.members.reduce((widest, m) => Math.max(widest, m.values.length), 0);

/**
 * Fold the actions' fields into the controls actually rendered. Options are
 * unioned, each carrying the actions that accept it, and the widest member
 * supplies the label and note — it is the one describing the full set.
 */
const buildFieldGroups = (
  chainId: number,
  protocol: string,
  actions: IProtocolActionDescriptor[],
): IProtocolFieldGroup[] => {
  const groups: IProtocolFieldGroup[] = [];

  for (const action of actions) {
    for (const field of action.fields) {
      const member: IProtocolFieldGroupMember = {
        action: action.action,
        key: field.key,
        values: (field.options ?? []).map((option) => option.value),
        optional: field.optional,
        ...(field.defaultValue === undefined
          ? {}
          : { defaultValue: field.defaultValue }),
      };
      const family = familyOf(action.action);
      const target = family
        ? groups.find(
          (group) =>
            group.members.every((existing) =>
              family.actions.has(existing.action),
            ) && fieldsDescribeSameChoice(group, field, family.match),
        )
        : undefined;

      if (!target) {
        groups.push({
          id: `${action.action}.${field.key}`,
          chainId,
          protocol,
          label: field.label,
          noun: singularize(field.label),
          control: field.control,
          pattern: field.pattern,
          note: field.note,
          options: field.options?.map((option) => ({
            ...option,
            actions: [action.action],
          })),
          members: [member],
        });
        continue;
      }

      const merged = new Map(
        (target.options ?? []).map((option) => [option.value, option]),
      );
      for (const option of field.options ?? []) {
        const existing = merged.get(option.value);
        merged.set(
          option.value,
          existing
            ? { ...existing, actions: [...existing.actions, action.action] }
            : { ...option, actions: [action.action] },
        );
      }
      if (member.values.length > widestMemberSize(target)) {
        target.label = field.label;
        target.noun = singularize(field.label);
        target.note = field.note;
      }
      target.options = [...merged.values()];
      target.members.push(member);
    }
  }

  // A caution belongs against the control it is about, not floating at the
  // top of the card: Aave's delegation warning reads as protocol-wide up
  // there. Each warning lands on the first group its action feeds, so the
  // delegate token picker carries it and the delegatee input below does not
  // repeat it.
  const placed = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) {
      const warning = actions.find((a) => a.action === member.action)?.warning;
      if (!warning || placed.has(warning)) continue;
      group.warning = warning;
      placed.add(warning);
    }
  }

  // A control two of a family's actions ended up sharing is named for the
  // family: "Stake & delegate" over one token list, rather than whichever
  // member happened to be widest lending it a second control labelled
  // "Assets".
  const familyNamed = new Set<IProtocolFieldGroup>();
  for (const group of groups) {
    const distinctActions = new Set(group.members.map((m) => m.action));
    const family = familyOf(group.members[0]?.action ?? "");
    if (distinctActions.size < 2 || !family?.label) continue;
    group.label = family.label;
    group.noun = family.noun ?? singularize(family.label);
    familyNamed.add(group);
  }

  // An action that kept its own section names it. Otherwise Aave shows three
  // controls all labelled "Assets" — the shared lending one, the safety
  // module's and governance's — which is unreadable. Only when the action
  // has a single chooser, so a chain that offers staking without delegation
  // still gets a "Stake" picker, while the delegatee address input keeps its
  // own label beneath the shared one.
  for (const action of actions) {
    const family = familyOf(action.action);
    if (family && !family.label) continue;
    const chosers = groups.filter(
      (group) =>
        !familyNamed.has(group) &&
        group.members.length === 1 &&
        group.members[0].action === action.action &&
        (group.control === "multi-select" || group.control === "single-select"),
    );
    if (chosers.length === 1) chosers[0].label = action.label;
  }
  return groups;
};

const buildAddressLabels = (
  entry: ProtocolDescriptor,
  entryData: unknown,
  aliasRows: IAliasRow[],
): Record<string, string> => {
  const labels: Record<string, string> = {};
  const namedAddresses = (entryData as any)?.addresses;
  if (namedAddresses && typeof namedAddresses === "object") {
    for (const [name, address] of Object.entries(namedAddresses)) {
      if (typeof address !== "string" || !isAddressLike(address)) continue;
      labels[address.toLowerCase()] =
        `${getProtocolLabel(entry.protocol)} ${prettifyKey(name.toLowerCase())}`;
    }
  }
  for (const row of aliasRows) {
    labels[row.address.toLowerCase()] = row.symbol;
  }
  return labels;
};

/**
 * Everything the registry can offer on a chain, flattened into renderable
 * descriptors. Empty on chains the registry does not cover yet.
 */
export const getRegistryProtocols = (
  chainId: ChainId | string,
): IProtocolDescriptor[] => {
  const numericChainId = toRegistryChainId(chainId);
  if (!Number.isFinite(numericChainId)) return [];

  return listProtocols(numericChainId).map((entry) => {
    // Aliases and `data` live on the registry entry itself, not the
    // descriptor; read them through the registry export to keep enrichment
    // optional.
    const { data: entryData, aliasRows } = getRegistryEntryInfo(
      numericChainId,
      entry.protocol,
    );
    const actions = entry.actions.map(({ action, schema }) => {
      const shape = (unwrapSchema(schema) as any)?.shape ?? {};
      return {
        action,
        label: getActionLabel(action),
        hint: getActionHint(action, entry.protocol),
        warning: getActionWarning(action, entry.protocol),
        fields: Object.entries(shape)
          .filter(([key]) => !RESERVED_SCHEMA_FIELDS.has(key))
          .map(([key, fieldSchema]) =>
            buildParamField(key, fieldSchema, aliasRows, entry.protocol, action),
          ),
      };
    });
    return {
      chainId: entry.chainId,
      protocol: entry.protocol,
      label: getProtocolLabel(entry.protocol),
      actions,
      groups: buildFieldGroups(entry.chainId, entry.protocol, actions),
      addressLabels: buildAddressLabels(entry, entryData, aliasRows),
    };
  });
};

const getRegistryEntryInfo = (
  numericChainId: number,
  protocol: string,
): { data: unknown; aliasRows: IAliasRow[] } => {
  try {
    const entry = getProtocolEntry(numericChainId, protocol);
    return {
      data: entry?.data,
      // First-class alias table when the registry ships one; the legacy
      // shape scan of `data` only for older registry versions.
      aliasRows: readEntryAliasTable(entry) ?? readAliasRows(entry?.data),
    };
  } catch {
    // A missing entry throws; for enrichment purposes that just means "no
    // extra metadata".
    return { data: undefined, aliasRows: [] };
  }
};

// ─── Selection state (owned by the UI, serializable) ────────────────────────

export interface IProtocolActionSelectionState {
  action: string;
  enabled: boolean;
  /** Field key → collected value; keys are omitted at build time when unset. */
  params: Record<string, unknown>;
}

export interface IProtocolSelectionState {
  protocol: string;
  enabled: boolean;
  actions: IProtocolActionSelectionState[];
}

export const initProtocolSelections = (
  protocols: IProtocolDescriptor[],
): IProtocolSelectionState[] =>
  protocols.map((protocol) => ({
    protocol: protocol.protocol,
    enabled: false,
    actions: protocol.actions.map((action) => ({
      action: action.action,
      // An action whose grant IS an asset list starts off and is switched on
      // by picking assets for it (see `isGoverningField`); an action with
      // nothing to pick — Spark's stake farm — starts on, so enabling the
      // protocol grants it and its own switch narrows.
      enabled: !action.fields.some(isGoverningField),
      params: Object.fromEntries(
        action.fields.flatMap((field): [string, unknown][] => {
          if (field.control === "multi-select") return [[field.key, []]];
          // The schema's OWN default, never a guess of ours. Aave's market
          // is ZodDefault("Core"), and reading it as required is what used
          // to open the card on "Market is required" — with the further
          // cost that, until a market is set, nothing can tell which
          // reserves are grantable. A field the registry does not default
          // stays unset.
          if (field.defaultValue !== undefined) {
            return [[field.key, field.defaultValue]];
          }
          return [];
        }),
      ),
    })),
  }));

// ─── Group ⇄ per-action selection state ─────────────────────────────────────

/**
 * A group as it stands right now, given which of its actions are live. The
 * state itself stays per-action — the registry is handed exactly the params
 * each action's own schema declares — so grouping is purely a presentation
 * layer over it, and narrowing one action cannot lose what was picked for
 * the others.
 */
export interface IProtocolGroupView {
  /** Options at least one active member accepts. */
  options: IProtocolFieldGroupOption[];
  /** Values held by at least one active member that accepts them. */
  selected: string[];
  /** No active member requires a value. */
  optional: boolean;
  /** Active member actions, in descriptor order. */
  actions: string[];
  /** Options another setting currently takes off the table; 0 when none. */
  narrowed: number;
}

// ─── Value spaces the generator narrows ─────────────────────────────────────

/**
 * A field's enum is its whole value space; a generator narrows it by the
 * action's OTHER settings. Aave's `market` chooses the pool, and only the
 * reserves that pool lists can be granted on it — Core carries all 67 of
 * the union enum, Prime 9, EtherFi 4. That rule lives in the generator, not
 * in the schema, so the only honest way to read it is to ask compile(),
 * which is also the only thing this file is allowed to ask: no generator
 * rule is ever restated here (SCHEMA.md).
 *
 * Without it the enum offers 67 assets under every market and the ones the
 * pool does not list fail at generation time — after the choice, with an
 * error naming a symbol the creator had no way to know was wrong.
 *
 * Memoized per (chain, protocol, action, field, settings): a probe is one
 * compile per candidate, and it pays for itself once per market.
 */
const narrowedValuesCache = new Map<string, Set<string> | null>();

/** The settings that could narrow a value space: the action's scalars. */
const narrowingSettings = (
  params: Record<string, unknown>,
): [string, unknown][] =>
  Object.entries(params)
    .filter(
      ([, value]) =>
        !Array.isArray(value) &&
        value !== undefined &&
        value !== null &&
        value !== "",
    )
    .sort(([a], [b]) => a.localeCompare(b));

/**
 * Which of `candidates` the action would accept as it is set right now, or
 * null when nothing narrows them.
 */
const narrowedValues = (
  chainId: number,
  protocol: string,
  action: string,
  key: string,
  candidates: string[],
  params: Record<string, unknown>,
): Set<string> | null => {
  const settings = narrowingSettings(params);
  if (!settings.length || !candidates.length) return null;

  const cacheKey = `${chainId}|${protocol}|${action}|${key}|${JSON.stringify(
    settings,
  )}`;
  const cached = narrowedValuesCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const base = Object.fromEntries(settings);
  const accepted = new Set(
    candidates.filter((value) => {
      try {
        compile({
          chainId,
          selections: [
            {
              protocol,
              action: action as Selection["action"],
              params: { ...base, [key]: [value] },
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }),
  );
  // Fail open. Settings that reject EVERY candidate say nothing about the
  // value space — a half-filled form, or a free-text address the generator
  // rejects on its own — and an empty asset list would strand the creator
  // with nothing to pick their way out with. The real grant is still gated
  // by validation and by compile() at save time.
  const narrowed = accepted.size ? accepted : null;
  narrowedValuesCache.set(cacheKey, narrowed);
  return narrowed;
};

/** What one member of a control may still hold, given its own settings. */
const memberNarrowing = (
  entry: IProtocolSelectionState | undefined,
  group: IProtocolFieldGroup,
  member: IProtocolFieldGroupMember,
): Set<string> | null => {
  if (group.control !== "multi-select") return null;
  const params = entry?.actions.find(
    (action) => action.action === member.action,
  )?.params;
  if (!params) return null;
  return narrowedValues(
    group.chainId,
    group.protocol,
    member.action,
    member.key,
    member.values,
    params,
  );
};

/**
 * The members a control speaks for. A governing member is always active:
 * its action's `enabled` flag is derived from this very selection, so
 * hiding its options while it holds none would make the scope unreachable —
 * nothing could ever switch it back on.
 *
 * So is a member the schema DEFAULTS. Its value is in force from the start
 * whether or not the action is on, and Aave's market is the case that
 * matters: it decides which reserves are grantable at all, so a card that
 * revealed it only after the first asset was picked would show 67 Core
 * assets, take the pick, and only then admit the pool was a choice.
 *
 * Everything else follows its action's flag, so the delegatee input — read
 * only when delegation is actually granted — still appears with the grant.
 */
const activeMembers = (
  entry: IProtocolSelectionState | undefined,
  group: IProtocolFieldGroup,
): IProtocolFieldGroupMember[] => {
  const governing = new Set(governingMembers(group).map((m) => m.action));
  return group.members.filter(
    (member) =>
      governing.has(member.action) ||
      member.defaultValue !== undefined ||
      (entry?.actions.find((a) => a.action === member.action)?.enabled ?? false),
  );
};

const memberValue = (
  entry: IProtocolSelectionState | undefined,
  member: IProtocolFieldGroupMember,
): unknown =>
  entry?.actions.find((a) => a.action === member.action)?.params[member.key];

export const viewGroup = (
  entry: IProtocolSelectionState | undefined,
  group: IProtocolFieldGroup,
): IProtocolGroupView => {
  const members = activeMembers(entry, group);
  const narrowing = new Map(
    members.map((member) => [
      member.action,
      memberNarrowing(entry, group, member),
    ]),
  );
  const accepts = (member: IProtocolFieldGroupMember, value: string) => {
    if (!member.values.includes(value)) return false;
    const allowed = narrowing.get(member.action);
    return !allowed || allowed.has(value);
  };
  // Two passes, so "narrowed" counts only what the GENERATOR took off the
  // table. An option the active members' schemas never accepted — Spark's
  // borrow-only reserves while only deposit is live — was never on it.
  const offered = (group.options ?? []).filter((option) =>
    members.some((member) => member.values.includes(option.value)),
  );
  const options = offered.filter((option) =>
    members.some((member) => accepts(member, option.value)),
  );

  let selected: string[];
  if (group.control === "multi-select") {
    // Held by AT LEAST ONE active member that accepts it: scopes are chosen
    // per value, so an asset carried by deposit but not borrow is granted —
    // for deposit — and the value's own scope list says which. Reading it as
    // "every member" would show a narrowed asset as unpicked.
    selected = options
      .map((option) => option.value)
      .filter((value) =>
        members
          .filter((member) => accepts(member, value))
          .some((member) => {
            const held = memberValue(entry, member);
            return Array.isArray(held) && held.includes(value);
          }),
      );
  } else {
    const held = members
      .map((member) => memberValue(entry, member))
      .find((value) => typeof value === "string" && value !== "");
    selected = typeof held === "string" && held !== "" ? [held] : [];
  }

  return {
    options,
    selected,
    optional: members.every((member) => member.optional),
    actions: members.map((member) => member.action),
    narrowed: offered.length - options.length,
  };
};

/**
 * Write a group's selection back into each active member's own params,
 * narrowed to the values that member's schema accepts — so picking Spark's
 * DSR_sDAI reaches deposit and is simply absent from borrow, which does not
 * offer it. Inactive members are left untouched rather than cleared, so a
 * scope coming back on restores what it had.
 */
export const applyGroupSelection = (
  descriptor: IProtocolDescriptor,
  entry: IProtocolSelectionState,
  group: IProtocolFieldGroup,
  values: string[],
): IProtocolSelectionState => {
  const members = new Map(
    activeMembers(entry, group).map((member) => [member.action, member]),
  );
  return normalizeActionEnablement(descriptor, {
    ...entry,
    actions: entry.actions.map((action) => {
      const member = members.get(action.action);
      if (!member) return action;
      const next =
        group.control === "multi-select"
          ? values.filter((value) => member.values.includes(value))
          : (values[0] ?? "");
      return { ...action, params: { ...action.params, [member.key]: next } };
    }),
  });
};

/**
 * One control's scopes: what a picked value is actually used FOR. The
 * members of a merged control are the choices a value can carry — deposit
 * and borrow over one asset list, stake and delegate over one token list —
 * and a value only ever offers the ones its own schema accepts, which is
 * why this is read per value rather than per control.
 */
export interface IProtocolValueScope {
  action: string;
  /** The schema field this scope writes into, for the optional caveat. */
  optional: boolean;
  /** The value is currently written into that field. */
  granted: boolean;
}

export const viewValueScopes = (
  entry: IProtocolSelectionState | undefined,
  group: IProtocolFieldGroup,
  value: string,
): IProtocolValueScope[] =>
  activeMembers(entry, group)
    .filter((member) => member.values.includes(value))
    .map((member) => {
      const held = memberValue(entry, member);
      return {
        action: member.action,
        optional: member.optional,
        granted: Array.isArray(held) && held.includes(value),
      };
    });

/**
 * Set exactly which scopes one value carries. Writing per (value, action)
 * rather than per control is what lets one asset be deposit-only while its
 * neighbour is also borrowable; members that do not accept the value are
 * never touched, and a value left with no scopes at all is simply gone from
 * every list — which for a governing member is what "not granted" means.
 */
export const applyValueScopes = (
  descriptor: IProtocolDescriptor,
  entry: IProtocolSelectionState,
  group: IProtocolFieldGroup,
  value: string,
  actions: string[],
): IProtocolSelectionState => {
  const members = new Map(
    activeMembers(entry, group)
      .filter((member) => member.values.includes(value))
      .map((member) => [member.action, member]),
  );
  return normalizeActionEnablement(descriptor, {
    ...entry,
    actions: entry.actions.map((action) => {
      const member = members.get(action.action);
      if (!member) return action;
      const held = action.params[member.key];
      const values = Array.isArray(held) ? (held as string[]) : [];
      const wanted = actions.includes(action.action);
      if (wanted === values.includes(value)) return action;
      return {
        ...action,
        params: {
          ...action.params,
          [member.key]: wanted
            ? [...values, value]
            : values.filter((existing) => existing !== value),
        },
      };
    }),
  });
};

/**
 * Keep every action's `enabled` flag in step with what its governing fields
 * hold. That flag is what `toCompileSelections` gates on, and for an action
 * whose grant IS its asset list there is nothing separate left to decide:
 * an empty list means not granted, while a stale `enabled: true` beside one
 * would compile to a schema error ("Required") instead of a permission.
 * Actions with no governing field — Spark's parameterless stake — keep
 * whatever the creator switched them to.
 */
export const normalizeActionEnablement = (
  descriptor: IProtocolDescriptor,
  entry: IProtocolSelectionState,
): IProtocolSelectionState => {
  const governing = new Map<string, IProtocolFieldGroupMember[]>();
  for (const group of descriptor.groups) {
    for (const member of governingMembers(group)) {
      governing.set(member.action, [
        ...(governing.get(member.action) ?? []),
        member,
      ]);
    }
  }
  const fieldsByAction = new Map(
    descriptor.actions.map((action) => [action.action, action.fields]),
  );
  let changed = false;
  const actions = entry.actions.map((action) => {
    // A setting can take values off the table after they were picked:
    // moving Aave's market from Core to Prime leaves 9 of the 67 reserves
    // grantable. A value the generator would now reject has to go, or the
    // save fails on an asset the form has already stopped showing.
    let params = action.params;
    for (const field of fieldsByAction.get(action.action) ?? []) {
      if (field.control !== "multi-select") continue;
      const held = params[field.key];
      if (!Array.isArray(held) || !held.length) continue;
      const allowed = narrowedValues(
        descriptor.chainId,
        descriptor.protocol,
        action.action,
        field.key,
        (field.options ?? []).map((option) => option.value),
        params,
      );
      if (!allowed) continue;
      const kept = held.filter(
        (value) => typeof value === "string" && allowed.has(value),
      );
      if (kept.length !== held.length) params = { ...params, [field.key]: kept };
    }

    const members = governing.get(action.action);
    // Every governing field, not just one: an action gated on two required
    // lists is granted only when both say something. Read off the PRUNED
    // params, so a market change that empties a list also switches its
    // action off.
    const enabled = members?.length
      ? members.every((member) => {
        const held = params[member.key];
        return Array.isArray(held) && held.length > 0;
      })
      : action.enabled;

    if (params === action.params && enabled === action.enabled) return action;
    changed = true;
    return { ...action, enabled, params };
  });
  return changed ? { ...entry, actions } : entry;
};

/** `normalizeActionEnablement` across a whole selection array. */
export const normalizeProtocolSelections = (
  protocols: IProtocolDescriptor[],
  selections: IProtocolSelectionState[],
): IProtocolSelectionState[] => {
  const descriptorByProtocol = new Map(
    protocols.map((protocol) => [protocol.protocol, protocol]),
  );
  return selections.map((entry) => {
    const descriptor = descriptorByProtocol.get(entry.protocol);
    return descriptor ? normalizeActionEnablement(descriptor, entry) : entry;
  });
};

/**
 * Selections the registry should actually compile: enabled protocol, enabled
 * action (see `normalizeActionEnablement`), params stripped of unset
 * optional keys (SCHEMA.md: omit the key entirely when unset).
 *
 * An empty array counts as unset, and the difference is not cosmetic. The
 * form seeds every multi-select to `[]`, while a generator reads an OMITTED
 * optional array as "no narrowing" and a PRESENT empty one as "narrow to
 * nothing" — Compound v3's deposit rejects the latter outright ("the
 * selected token set must not be empty"). A required array that is still
 * empty never reaches here: validateProtocolSelections stops it first, and
 * omitting the key would fail the schema's own required check anyway, so
 * this stays fail-closed.
 */
const toCompileSelections = (
  selections: IProtocolSelectionState[],
): Selection[] =>
  selections
    .filter((protocol) => protocol.enabled)
    .flatMap((protocol) =>
      protocol.actions
        .filter((action) => action.enabled)
        .map((action) => ({
          protocol: protocol.protocol,
          action: action.action as Selection["action"],
          params: Object.fromEntries(
            Object.entries(action.params).filter(
              ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !(Array.isArray(value) && value.length === 0),
            ),
          ),
        })),
    );

export const hasEnabledProtocolSelections = (
  selections: IProtocolSelectionState[],
): boolean => toCompileSelections(selections).length > 0;

// ─── Validation ─────────────────────────────────────────────────────────────

export interface IProtocolSelectionIssue {
  protocol: string;
  action?: string;
  message: string;
}

/**
 * Form-level validation: local completeness checks, then the registry's own
 * validateSelections for everything schema-shaped. Runs on the normalized
 * selections so a hand-built or stale entry (an action left switched on
 * beside an emptied asset list) is judged as what it would actually
 * compile to, not as the contradiction it stores.
 */
export const validateProtocolSelections = (
  chainId: ChainId | string,
  selections: IProtocolSelectionState[],
  protocols: IProtocolDescriptor[] = getRegistryProtocols(chainId),
): IProtocolSelectionIssue[] => {
  const issues: IProtocolSelectionIssue[] = [];
  const descriptorByProtocol = new Map(
    protocols.map((protocol) => [protocol.protocol, protocol]),
  );
  const normalized = normalizeProtocolSelections(protocols, selections);

  for (const protocol of normalized) {
    if (!protocol.enabled) continue;
    const descriptor = descriptorByProtocol.get(protocol.protocol);
    if (!descriptor) continue;
    const enabledActions = protocol.actions.filter((action) => action.enabled);
    if (!enabledActions.length) {
      const grantedByPicking = descriptor.groups.some(
        (group) => governingMembers(group).length > 0,
      );
      issues.push({
        protocol: protocol.protocol,
        message: grantedByPicking
          ? `${descriptor.label}: select at least one asset to grant, or switch the protocol off.`
          : `${descriptor.label}: enable at least one action or switch the protocol off.`,
      });
      continue;
    }
    // Reported per rendered control, not per action: one shared picker left
    // empty is one problem to fix, however many actions read it.
    for (const group of descriptor.groups) {
      // A governing control IS the grant, so leaving it empty is a choice —
      // those scopes are not granted — and the actions behind it are already
      // switched off in step. Only what a granted action still REQUIRES is
      // an error: its market, its delegatee.
      if (governingMembers(group).length) continue;
      const view = viewGroup(protocol, group);
      // Required by an action that is actually GRANTED — not merely by one
      // whose control is on screen. A schema-defaulted control shows from
      // the start (see `activeMembers`), and Aave's market being visible
      // beside a delegate-only selection is not a missing market.
      const live = group.members.filter(
        (member) =>
          protocol.actions.find((action) => action.action === member.action)
            ?.enabled,
      );
      if (!live.length || live.every((m) => m.optional) || view.selected.length) {
        continue;
      }
      issues.push({
        protocol: protocol.protocol,
        action: live.length === 1 ? live[0].action : undefined,
        message:
          group.control === "multi-select"
            ? `${descriptor.label} · ${group.label}: select at least one ${group.noun}.`
            : `${descriptor.label}: ${group.label} is required.`,
      });
    }
  }
  if (issues.length) return issues;

  const compileSelections = toCompileSelections(normalized);
  if (!compileSelections.length) return issues;

  const result = validateSelections({
    chainId: toRegistryChainId(chainId),
    selections: compileSelections,
  });
  for (const issue of result.issues) {
    const selection = compileSelections[issue.selectionIndex];
    const label = getProtocolLabel(selection?.protocol ?? issue.protocol ?? "");
    if (issue.kind === "invalid-params") {
      const detail = issue.issues
        .map((zodIssue) => zodIssue.message)
        .join("; ");
      issues.push({
        protocol: selection?.protocol ?? "",
        action: selection?.action,
        message: `${label} · ${getActionLabel(selection?.action ?? "")}: ${detail}`,
      });
    } else {
      issues.push({
        protocol: selection?.protocol ?? "",
        action: selection?.action,
        message: `${label}: this ${issue.kind === "unknown-action" ? "action" : "protocol"} is not available on the selected chain.`,
      });
    }
  }
  return issues;
};

// ─── Building the Roles-modifier entries ────────────────────────────────────

export interface IProtocolPermissionsBuild {
  /** Encoded Roles-modifier calldata, in order, for submitPermissions. */
  entries: string[];
  /** Human-readable form of each entry, for review UIs and logs. */
  descriptions: string[];
  /** Desired-state target addresses — spare these from any revokeTarget. */
  targetAddresses: string[];
  /** Every (target, selector) the desired state grants. */
  grantedScopes: IPermissionScope[];
  /** What was compiled, for the transaction log. */
  selections: Selection[];
  packageVersion: string;
}

const emptyBuild = (): IProtocolPermissionsBuild => ({
  entries: [],
  descriptions: [],
  targetAddresses: [],
  grantedScopes: [],
  selections: [],
  packageVersion: PACKAGE_VERSION,
});

const scopesFromTargets = (
  targets: readonly {
    address: string;
    functions?: readonly { selector: string }[];
  }[],
): IPermissionScope[] =>
  targets.flatMap((target) =>
    (target.functions ?? []).length
      ? (target.functions ?? []).map((fn) => ({
        target: target.address,
        selector: fn.selector,
      }))
      : // A whole-target allowance has no selectors; the zero selector keeps
    // it representable as a scope (its revokeFunction is a no-op — the
    // paired revokeTarget is what clears it).
      [{ target: target.address, selector: "0x00000000" }],
  );

/**
 * The user's protocol selections, compiled by the registry into ready
 * Roles-modifier calldata for this step's submitPermissions batch. The
 * vault's role is freshly initialized on this step, so the wholesale-replace
 * pipeline is asked to clear nothing (currentTargets defaults to []); the
 * authoritative-save revocations are handled by the caller through
 * listRegistryScopeUniverse.
 *
 * Throws the registry's typed errors (InvalidParamsError, IntegrityError…)
 * — callers surface the message and abort the save.
 */
export const buildProtocolPermissionEntries = (options: {
  chainId: ChainId | string;
  rolesModAddress: string;
  selections: IProtocolSelectionState[];
}): IProtocolPermissionsBuild => {
  // Same normalization the validation ran: an action switched on beside an
  // emptied governing list compiles to a schema error, and the two paths
  // must never disagree about what the save contains.
  const compileSelections = toCompileSelections(
    normalizeProtocolSelections(
      getRegistryProtocols(options.chainId),
      options.selections,
    ),
  );
  if (!compileSelections.length) return emptyBuild();

  const { targets } = compile({
    chainId: toRegistryChainId(options.chainId),
    selections: compileSelections,
  });
  const payload = deriveReplaceCalls({
    // Lowercased so any casing is accepted; the registry re-checksums it and
    // rejects malformed input either way.
    rolesMod: options.rolesModAddress.toLowerCase(),
    // Same role, same bytes, as every other entry in the batch. encodeKey
    // passes an already-encoded bytes32 through untouched.
    roleKey: ethers.encodeBytes32String(DEFAULT_ROLE_KEY_V2),
    targets,
  });

  return {
    entries: payload.calls.map((call) => call.data),
    descriptions: payload.calls.map((call) => call.description),
    targetAddresses: targets.map((target) => target.address),
    grantedScopes: scopesFromTargets(targets),
    selections: compileSelections,
    packageVersion: PACKAGE_VERSION,
  };
};

// ─── The registry scope universe (authoritative re-saves) ───────────────────

/**
 * Stands in for a required free-text field when enumerating the universe.
 * The universe only needs (target, selector) pairs, and a schema-checked
 * text value (e.g. a delegatee address, which only ever lands in calldata
 * conditions) does not move those — so any accepted value will do. Chosen
 * to be recognisable: if a compile ever emits a placeholder AS a target
 * address, that action's scope depends on the field's value and cannot be
 * pre-enumerated (see the poison check below).
 */
const UNIVERSE_TEXT_PLACEHOLDERS = [
  "0x0000000000000000000000000000000000000001",
  "1",
  "placeholder",
];

/** Fan-out guard: a pathological schema stops enumerating, not the browser. */
const MAX_UNIVERSE_VARIANTS_PER_ACTION = 64;

/** Marks the fan-out variant where an optional field is left out entirely. */
const OMIT_FIELD = Symbol("omit-universe-field");

interface IUniverseActionPlan {
  /** Field values shared by every variant: maximal arrays, placeholders. */
  base: Record<string, unknown>;
  /** Keys of maximised array-of-enum fields, prunable value-by-value. */
  arrayKeys: string[];
  /** Fan-out fields; the plan compiles every product of their values. */
  dims: { key: string; values: (string | string[] | typeof OMIT_FIELD)[] }[];
  /** Placeholder values standing in for required free-text fields. */
  placeholders: string[];
}

/** How a field's wrapper chain treats an omitted key. */
const fieldWrappers = (
  schema: any,
): { optional: boolean; hasDefault: boolean } => {
  let optional = false;
  let hasDefault = false;
  let current = schema;
  for (;;) {
    const def = zodDef(current);
    if (def.typeName === "ZodOptional") {
      optional = true;
      current = def.innerType;
    } else if (def.typeName === "ZodDefault") {
      hasDefault = true;
      current = def.innerType;
    } else if (def.typeName === "ZodEffects") {
      current = def.schema;
    } else {
      return { optional, hasDefault };
    }
  }
};

/**
 * Turn an action's schema shape into an enumeration plan, or a reason it
 * cannot be enumerated. Field by field:
 * - array-of-enum → maximised (every value at once); an OPTIONAL one also
 *   fans out its omitted branch, which is often the widest of the two:
 *   Compound v3's `tokens` narrows the markets picked in `targets`, so
 *   leaving it out grants every asset of every selected market, while a
 *   maximised array has to name assets that satisfy all of them at once and
 *   simply fails to compile;
 * - scalar enum → a fan-out dimension, one variant per value, however the
 *   field is wrapped: a `.default()`ed or `.optional()` enum's non-default
 *   values are still reachable grants, so the universe must cover each. A
 *   plain-optional enum also grants along its omitted branch, so that
 *   variant joins the fan-out (a defaulted one parses omission into one of
 *   the values, already covered);
 * - anything else optional → the key is omitted, as an unset form control
 *   would leave it;
 * - required free-text → a placeholder the field schema accepts;
 * - any other required shape → not enumerable.
 */
const planUniverseAction = (
  shape: Record<string, unknown>,
): IUniverseActionPlan | string => {
  const plan: IUniverseActionPlan = {
    base: {},
    arrayKeys: [],
    dims: [],
    placeholders: [],
  };
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const { optional, hasDefault } = fieldWrappers(fieldSchema);
    const core = unwrapSchema(fieldSchema);
    const def = zodDef(core);
    if (def.typeName === "ZodArray") {
      const elementDef = zodDef(unwrapSchema(def.type));
      if (elementDef.typeName === "ZodEnum") {
        const maximal = [...elementDef.values];
        // A defaulted array is never seen as absent by a generator (zod
        // fills it in), so only a plain-optional one needs both branches.
        if (optional && !hasDefault) {
          plan.dims.push({ key, values: [maximal, OMIT_FIELD] });
        } else {
          plan.base[key] = maximal;
        }
        plan.arrayKeys.push(key);
        continue;
      }
    }
    if (def.typeName === "ZodEnum") {
      const values: (string | typeof OMIT_FIELD)[] = [...def.values];
      if (optional && !hasDefault) values.push(OMIT_FIELD);
      plan.dims.push({ key, values });
      continue;
    }
    if (optional || hasDefault) continue;
    if (def.typeName === "ZodString") {
      const placeholder = UNIVERSE_TEXT_PLACEHOLDERS.find(
        (candidate) => (fieldSchema as any)?.safeParse?.(candidate)?.success,
      );
      if (placeholder !== undefined) {
        plan.base[key] = placeholder;
        plan.placeholders.push(placeholder);
        continue;
      }
      return `required text field "${key}" accepts no known placeholder`;
    }
    return `required field "${key}" has a shape this cannot maximise`;
  }
  return plan;
};

/** Every combination of the fan-out dimensions' values. */
const cartesianParams = (
  dims: IUniverseActionPlan["dims"],
): Record<string, unknown>[] =>
  dims.reduce<Record<string, unknown>[]>(
    (combos, dim) =>
      combos.flatMap((combo) =>
        dim.values.map((value) =>
          value === OMIT_FIELD ? combo : { ...combo, [dim.key]: value },
        ),
      ),
    [{}],
  );

/**
 * Compile one candidate selection into scopes, pruning maximised arrays
 * value-by-value when the whole does not compile. Rejections come from two
 * layers, but through one gate: schema refinements (eth: market EtherFi has
 * no native path, so maximal targets fail on "ETH") and generation-time
 * rules (a market only holds a subset of the union reserve enum) both
 * surface as compile() errors — and both gate a real user grant
 * identically, so a value pruned here was never grantable in this
 * combination and its absence loses no revoke coverage (other variants,
 * e.g. the Core market's, still cover their own combinations).
 *
 * Returns null when nothing in the variant compiles. `valueByValue` marks
 * the fallback where the pruned whole still failed and the scopes are the
 * union of the per-value probes — real compile() outputs, but permissions
 * that only appear for value combinations (none known today) would be
 * missed, so the caller flags the action incomplete.
 */
const compileUniverseVariant = (
  compileParams: (params: Record<string, unknown>) => IPermissionScope[],
  params: Record<string, unknown>,
  arrayKeys: string[],
): { scopes: IPermissionScope[]; valueByValue: boolean } | null => {
  try {
    return { scopes: compileParams(params), valueByValue: false };
  } catch {
    if (!arrayKeys.length) return null;
  }

  // Probe each array value alone (other arrays emptied, scalars kept) so a
  // rejected value cannot mask the rest of its own or another array. An
  // array the variant omits stays omitted — reintroducing it as `[]` would
  // read as "narrow to nothing", which is a different (and often rejected)
  // request than the omission being probed.
  const emptyArrays = Object.fromEntries(
    arrayKeys
      .filter((key) => Array.isArray(params[key]))
      .map((key) => [key, []]),
  );
  const probeScopes: IPermissionScope[] = [];
  const pruned: Record<string, unknown> = { ...params };
  let keptAny = false;
  for (const key of arrayKeys) {
    const values = params[key];
    if (!Array.isArray(values)) continue;
    pruned[key] = values.filter((value) => {
      try {
        probeScopes.push(
          ...compileParams({ ...params, ...emptyArrays, [key]: [value] }),
        );
        keptAny = true;
        return true;
      } catch {
        return false;
      }
    });
  }
  if (!keptAny) return null;

  try {
    return { scopes: compileParams(pruned), valueByValue: false };
  } catch {
    return { scopes: probeScopes, valueByValue: true };
  }
};

/**
 * Saving this step is authoritative: a permission that is off is revoked,
 * not merely left out, because an earlier save may already have granted it
 * (see revokePermissions.ts). For protocol grants that means revoking every
 * (target, selector) the registry could EVER grant on this chain — the
 * union of compiling every enumerable selection (see planUniverseAction) —
 * minus what the current selection grants; revoking something never granted
 * is a no-op on the modifier.
 *
 * Every candidate selection still goes through the registry's compile() —
 * nothing here constructs permission JSON (charter rule). Scopes that turn
 * out to hinge on a free-text value (the placeholder itself compiled into a
 * target address) are discarded, and any action whose coverage stays
 * incomplete is warned about — its stale grants would need the registry's
 * future diff-based apply to clean up.
 */
export const listRegistryScopeUniverse = (
  chainId: ChainId | string,
): IPermissionScope[] => {
  const numericChainId = toRegistryChainId(chainId);
  const cached = scopeUniverseCache.get(numericChainId);
  if (cached) return cached;

  const universe: IPermissionScope[] = [];
  const seen = new Set<string>();

  for (const protocol of listProtocols(numericChainId)) {
    for (const { action, schema } of protocol.actions) {
      const warnIncomplete = (reason: string) =>
        console.warn(
          `[protocolPermissions] cannot enumerate ${protocol.protocol}.${action} fully for authoritative revokes (${reason}); a narrowing re-save may leave stale grants`,
        );

      const shape = (unwrapSchema(schema) as any)?.shape ?? {};
      const plan = planUniverseAction(shape);
      if (typeof plan === "string") {
        warnIncomplete(plan);
        continue;
      }
      const variantCount = plan.dims.reduce(
        (count, dim) => count * dim.values.length,
        1,
      );
      if (variantCount > MAX_UNIVERSE_VARIANTS_PER_ACTION) {
        warnIncomplete(
          `${variantCount} enum combinations exceed the fan-out cap`,
        );
        continue;
      }

      const compileParams = (
        params: Record<string, unknown>,
      ): IPermissionScope[] =>
        scopesFromTargets(
          compile({
            chainId: numericChainId,
            selections: [
              {
                protocol: protocol.protocol,
                action: action as Selection["action"],
                params,
              },
            ],
          }).targets,
        );

      const actionScopes: IPermissionScope[] = [];
      const reasons = new Set<string>();
      for (const combo of cartesianParams(plan.dims)) {
        const result = compileUniverseVariant(
          compileParams,
          { ...plan.base, ...combo },
          plan.arrayKeys,
        );
        if (!result) {
          // Nothing in the variant compiles, so nothing was grantable under
          // it either — unless a placeholder was in play, where a generator
          // rejecting the placeholder value itself is indistinguishable
          // from genuine ungrantability.
          if (plan.placeholders.length) {
            reasons.add("a placeholder-built selection would not compile");
          }
          continue;
        }
        if (result.valueByValue) {
          reasons.add(
            "combination permissions could only be derived value-by-value",
          );
        }
        actionScopes.push(...result.scopes);
      }

      // Poison check: a placeholder surfacing as a TARGET means this
      // action's scope depends on the free-text value, which future saves
      // cannot re-derive — those scopes are dropped rather than trusted.
      const poisonedTargets = new Set(
        plan.placeholders
          .filter(isAddressLike)
          .map((value) => value.toLowerCase())
          .filter((value) =>
            actionScopes.some((scope) => scope.target.toLowerCase() === value),
          ),
      );
      if (poisonedTargets.size) {
        reasons.add("a free-text value determines part of its scope");
      }
      if (reasons.size) warnIncomplete([...reasons].join("; "));

      for (const scope of actionScopes) {
        const target = scope.target.toLowerCase();
        if (poisonedTargets.has(target)) continue;
        const key = `${target}:${scope.selector.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        universe.push(scope);
      }
    }
  }

  scopeUniverseCache.set(numericChainId, universe);
  return universe;
};

const scopeUniverseCache = new Map<number, IPermissionScope[]>();

/** Scopes to revoke on save: the universe minus what is being granted now. */
export const listProtocolScopesToRevoke = (
  chainId: ChainId | string,
  build: IProtocolPermissionsBuild,
): IPermissionScope[] => {
  const granted = new Set(
    build.grantedScopes.map(
      (scope) =>
        `${scope.target.toLowerCase()}:${scope.selector.toLowerCase()}`,
    ),
  );
  return listRegistryScopeUniverse(chainId).filter(
    (scope) =>
      !granted.has(
        `${scope.target.toLowerCase()}:${scope.selector.toLowerCase()}`,
      ),
  );
};
