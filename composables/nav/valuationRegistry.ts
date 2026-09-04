import {
  compileValuation,
  listAliases,
  listValuationProtocols,
  validateValuationSelections,
  type ValuationContext,
  type ValuationMethodDescriptor,
} from "@rethink-finance/positions-registry";
import {
  getProtocolLabel,
  getProtocolLogoUrl,
  schemaDefault,
  toRegistryChainId,
  unwrapSchema,
  zodDef,
} from "~/composables/permissions/protocolPermissions";
import { rawEntriesToNavMethods } from "~/composables/nav/rawNavEntries";
import type { IRawNavEntry } from "~/composables/nav/rawNavEntries";
import type { ChainId } from "~/types/enums/chain_id";
import type INAVMethod from "~/types/nav_method";

/**
 * The NAV-method library backed by the positions registry's `valuation`
 * blocks (VALUATION.md there). Mirrors the permissions card's contract:
 * the registry's zod schemas are the only source of controls, this module
 * only introspects them into renderable fields and hands selected values
 * back verbatim; `compileValuation` produces the NAV entries, never the UI.
 */

/** What the generators need to know about the vault being valued. */
export interface IValuationVaultContext {
  safe: string;
  fund: string;
  baseToken: { address: string; decimals: number; symbol: string };
}

export interface IValuationOption {
  value: string;
  label: string;
  /** Token address for the mark, when the option names a token or vault. */
  tokenAddress?: string;
  /** Whether this vault can value the option (registry `supportedTargets`). */
  supported: boolean;
}

export type ValuationControl = "multi-select" | "single-select" | "switch" | "text";

export interface IValuationField {
  key: string;
  label: string;
  hint?: string;
  control: ValuationControl;
  options: IValuationOption[];
  defaultValue: unknown;
  placeholder?: string;
  /** The method's target list — the field `supportedTargets` filters. */
  isTarget: boolean;
}

export interface IValuationMethodView {
  protocol: string;
  method: string;
  kind: ValuationMethodDescriptor["kind"];
  label: string;
  description: string;
  fields: IValuationField[];
}

export interface IValuationProtocolView {
  protocol: string;
  label: string;
  logoUrl: string;
  methods: IValuationMethodView[];
}

export interface IValuationSelection {
  protocol: string;
  method: string;
  params: Record<string, unknown>;
}

export interface IValuationPreviewRow {
  positionName: string;
  valuationSource: string;
  entryType: string;
}

const PROTOCOL_LABEL_OVERRIDES: Record<string, string> = {
  spot: "Spot assets",
};

const FIELD_LABELS: Record<string, string> = {
  tokens: "Tokens",
  targets: "Assets",
  markets: "Markets",
  vaults: "Vaults",
  market: "Market",
  includeDebt: "Subtract borrowed amounts",
};

const FIELD_HINTS: Record<string, string> = {};

const isAddressLike = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value);

export const getValuationProtocolLabel = (protocol: string): string =>
  PROTOCOL_LABEL_OVERRIDES[protocol] ?? getProtocolLabel(protocol);

export const isValuationContextReady = (
  ctx: Partial<IValuationVaultContext> | null | undefined,
): ctx is IValuationVaultContext =>
  !!ctx &&
  isAddressLike(ctx.safe ?? "") &&
  isAddressLike(ctx.fund ?? "") &&
  isAddressLike(ctx.baseToken?.address ?? "") &&
  Number.isInteger(ctx.baseToken?.decimals);

const toRegistryContext = (
  chainId: ChainId,
  ctx: IValuationVaultContext,
): ValuationContext => ({
  chainId: toRegistryChainId(chainId),
  safe: ctx.safe as `0x${string}`,
  fund: ctx.fund as `0x${string}`,
  baseToken: {
    address: ctx.baseToken.address as `0x${string}`,
    decimals: ctx.baseToken.decimals,
    symbol: ctx.baseToken.symbol,
  },
});

/**
 * Options of an enum, with address aliases folded into their named rows
 * (SCHEMA.md's alias table): a symbol and its address are one option, the
 * address kept for the mark. Id-keyed rows (Morpho vaults) show the
 * registry's display label for the id.
 */
const buildOptions = (
  values: string[],
  aliases: readonly { name: string; address?: string; id?: string }[],
  supported: ReadonlySet<string> | null,
): IValuationOption[] => {
  const nameByAddress = new Map<string, string>();
  const addressByName = new Map<string, string>();
  const labelById = new Map<string, string>();
  for (const alias of aliases) {
    if (alias.id !== undefined) labelById.set(alias.id.toLowerCase(), alias.name);
    if (alias.address) {
      nameByAddress.set(alias.address.toLowerCase(), alias.name);
      addressByName.set(alias.name, alias.address);
    }
  }
  const names = new Set(values.filter((v) => !isAddressLike(v)));
  const options: IValuationOption[] = [];
  for (const value of values) {
    if (isAddressLike(value)) {
      const name = nameByAddress.get(value.toLowerCase());
      // The address spelling of a listed name: folded into that name.
      if (name && names.has(name)) continue;
      options.push({
        value,
        label:
          labelById.get(value.toLowerCase()) ??
          name ??
          `${value.slice(0, 6)}…${value.slice(-4)}`,
        tokenAddress: value,
        supported: supported ? supported.has(value) : true,
      });
      continue;
    }
    options.push({
      value,
      label: value,
      tokenAddress: addressByName.get(value),
      supported: supported ? supported.has(value) : true,
    });
  }
  return options;
};

const buildField = (
  key: string,
  schema: any,
  method: ValuationMethodDescriptor,
  aliases: readonly { name: string; address?: string; id?: string }[],
  ctx: ValuationContext | null,
): IValuationField | null => {
  const core = unwrapSchema(schema);
  const def = zodDef(core);
  const isTarget = method.targetField === key;
  const supported =
    isTarget && ctx && method.supportedTargets
      ? new Set(method.supportedTargets(ctx))
      : null;
  const base = {
    key,
    label: FIELD_LABELS[key] ?? key,
    hint: FIELD_HINTS[key],
    isTarget,
  };
  if (def.typeName === "ZodArray") {
    const element = zodDef(unwrapSchema(def.type));
    if (element.typeName !== "ZodEnum") return null;
    return {
      ...base,
      control: "multi-select",
      options: buildOptions([...element.values], aliases, supported),
      defaultValue: [],
    };
  }
  if (def.typeName === "ZodEnum") {
    const options = buildOptions([...def.values], aliases, supported);
    return {
      ...base,
      control: "single-select",
      options,
      defaultValue: schemaDefault(schema) ?? options[0]?.value,
    };
  }
  if (def.typeName === "ZodBoolean") {
    let defaultValue = false;
    const outer = zodDef(schema);
    if (outer.typeName === "ZodDefault") {
      const value: unknown = outer.defaultValue?.();
      defaultValue = value === true;
    }
    return { ...base, control: "switch", options: [], defaultValue };
  }
  if (def.typeName === "ZodString") {
    return {
      ...base,
      control: "text",
      options: [],
      defaultValue: "",
      placeholder: "",
    };
  }
  return null;
};

/**
 * The protocols with valuation methods on a chain, each method's schema
 * introspected into fields. Pass the vault context to mark which targets
 * this vault can value; without it every option reads as supported.
 */
export const listValuationLibrary = (
  chainId: ChainId,
  ctx: IValuationVaultContext | null,
): IValuationProtocolView[] => {
  const registryChainId = toRegistryChainId(chainId);
  const registryCtx = ctx ? toRegistryContext(chainId, ctx) : null;
  // Spot assets lead the library; protocols follow in registry order.
  const protocols = [...listValuationProtocols(registryChainId)].sort(
    (a, b) => Number(b.protocol === "spot") - Number(a.protocol === "spot"),
  );
  return protocols.map((protocol) => {
    const aliases = listAliases(registryChainId, protocol.protocol) ?? [];
    return {
      protocol: protocol.protocol,
      label: getValuationProtocolLabel(protocol.protocol),
      logoUrl: getProtocolLogoUrl(protocol.protocol),
      methods: protocol.methods.map((method): IValuationMethodView => {
        const shape: Record<string, any> = unwrapSchema(method.schema)?.shape ?? {};
        const fields = Object.entries(shape)
          .map(([key, fieldSchema]) =>
            buildField(key, fieldSchema, method, aliases, registryCtx),
          )
          .filter((field): field is IValuationField => field !== null);
        return {
          protocol: protocol.protocol,
          method: method.method,
          kind: method.kind,
          label: method.label,
          description: method.description,
          fields,
        };
      }),
    };
  });
};

/** A method's untouched form state. */
export const initValuationParams = (
  method: IValuationMethodView,
): Record<string, unknown> =>
  Object.fromEntries(method.fields.map((f) => [f.key, f.defaultValue]));

/**
 * Whether the form says anything worth compiling: a target list with a
 * pick, or (for target-less methods) every text field filled.
 */
export const isValuationSelectionActive = (
  method: IValuationMethodView,
  params: Record<string, unknown>,
): boolean => {
  const target = method.fields.find((f) => f.isTarget);
  if (target) {
    const value = params[target.key];
    return Array.isArray(value) ? value.length > 0 : !!value;
  }
  return method.fields
    .filter((f) => f.control === "text")
    .every((f) => String(params[f.key] ?? "").trim() !== "");
};

/** Params as the registry accepts them: empty text omitted, lists verbatim. */
export const toValuationParams = (
  method: IValuationMethodView,
  params: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of method.fields) {
    const value = params[field.key];
    if (field.control === "text") {
      const text = String(value ?? "").trim();
      if (text) out[field.key] = text;
    } else if (value !== undefined) {
      out[field.key] = value;
    }
  }
  return out;
};

export interface IValuationCompileResult {
  methods: INAVMethod[];
  preview: IValuationPreviewRow[];
  notes: string[];
  /** Human-readable validation problems, keyed by `protocol.method`. */
  issues: Record<string, string[]>;
}

/**
 * Compiles the selections into NAV methods indexed after `existingCount`.
 * Validation problems come back as issues instead of throwing, so the
 * form can annotate while the curator is still typing.
 */
export const compileValuationMethods = (
  chainId: ChainId,
  ctx: IValuationVaultContext,
  selections: IValuationSelection[],
  existingCount: number,
): IValuationCompileResult => {
  const registryChainId = toRegistryChainId(chainId);
  const issues: Record<string, string[]> = {};
  const validation = validateValuationSelections({
    chainId: registryChainId,
    selections,
  });
  for (const issue of validation.issues) {
    const selection = selections[issue.selectionIndex];
    const key = selection ? `${selection.protocol}.${selection.method}` : "?";
    const messages =
      issue.kind === "invalid-params"
        ? issue.issues.map((z) => `${z.path.join(".") || "value"}: ${z.message}`)
        : [issue.kind === "unknown-method" ? "Unknown method" : "Unknown protocol"];
    issues[key] = [...(issues[key] ?? []), ...messages];
  }
  if (!validation.valid) {
    return { methods: [], preview: [], notes: [], issues };
  }
  const result = compileValuation({
    chainId: registryChainId,
    context: toRegistryContext(chainId, ctx),
    selections,
  });
  const entries = result.methods.map((m) => m.entry as unknown as IRawNavEntry);
  return {
    methods: rawEntriesToNavMethods(entries, existingCount),
    preview: entries.map((entry) => ({
      positionName: entry.description?.positionName ?? "",
      valuationSource: entry.description?.valuationSource ?? "",
      entryType: entry.entryType,
    })),
    notes: [...result.notes],
    issues,
  };
};
