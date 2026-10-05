<template>
  <div class="queue">
    <div class="queue__head">
      <span class="queue__title">{{ title }}</span>
      <span class="queue__summary">{{ summary }}</span>
      <span class="queue__head_action">
        <button
          type="button"
          class="queue__copy"
          :title="`Copy all ${entries.length} calls' calldata as a JSON array`"
          @click="copyAll"
        >
          {{ copied === "all" ? "Copied" : "Copy as JSON" }}
        </button>
        <slot name="head-action" />
      </span>
    </div>

    <!-- One block per contract: where the role is let in, and what it may
         do there. Membership changes and allowances, which belong to no
         contract, get a block of their own. -->
    <section
      v-for="group in groups"
      :key="group.key"
      class="queue__group"
    >
      <header class="queue__group_head">
        <div class="queue__group_title">
          <button
            v-if="collapsible"
            type="button"
            class="queue__toggle"
            :aria-expanded="isOpen(group)"
            :aria-label="`${isOpen(group) ? 'Hide' : 'Show'} what is allowed here`"
            @click="toggle(group)"
          >
            <Icon
              class="queue__chevron"
              :class="{ 'queue__chevron--open': isOpen(group) }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
          </button>
          <OnboardingExplorerAddress
            v-if="group.target"
            :address="group.target"
            :chain-id="chainId"
            :label="labelFor(group.target)"
          />
          <span v-else class="queue__group_name">{{ GROUP_NAMES[group.kind] }}</span>
          <!-- The step already says whose permissions these are (the role
               picked at its top), so a block is only tagged when its calls
               name some OTHER role, which is the thing worth noticing. -->
          <span
            v-for="role in otherRoles(group)"
            :key="role"
            class="queue__role"
            :title="`Role key: ${role}`"
          >{{ queuedRoleName(role) }}</span>
          <button
            v-if="collapsible"
            type="button"
            class="queue__group_summary"
            @click="toggle(group)"
          >
            {{ groupSummary(group) }}
          </button>
          <span v-if="collapsible && hasWarning(group)" class="queue__group_flag">
            changes when stored
          </span>
        </div>
        <button
          v-if="actionable(group).length > 1"
          type="button"
          class="queue__action"
          @click="emit('discard', actionable(group))"
        >
          {{ actionLabel }} all
        </button>
      </header>

      <div
        v-for="call in isOpen(group) ? group.calls : []"
        :key="call.index"
        class="queue__row"
        :class="`queue__row--${call.description.tone}`"
      >
        <div class="queue__what">
          <!-- Target level -->
          <p v-if="call.description.action === 'scope-target'" class="queue__line queue__line--muted">
            {{ grantCount(group) ? "Opens this contract for the functions below" : "Opens this contract, with no function allowed yet: nothing gets through" }}
          </p>
          <p v-else-if="call.description.action === 'allow-target'" class="queue__line queue__line--warn">
            Any function on this contract, with any arguments
          </p>
          <p v-else-if="call.description.action === 'revoke-target'" class="queue__line queue__line--revoke">
            All access to this contract is removed
          </p>

          <!-- Function level -->
          <template v-else-if="FUNCTION_ACTIONS.has(call.description.action)">
            <p class="queue__line">
              <code class="queue__fn">{{ functionLabel(call) }}</code>
              <span class="queue__verdict" :class="{ 'queue__verdict--revoke': call.description.action === 'revoke-function' }">
                {{ verdict(call) }}
              </span>
            </p>
            <ul v-if="limitLines(call).length" class="queue__limits">
              <li
                v-for="(line, i) in limitLines(call)"
                :key="i"
                :style="line.depth ? { paddingLeft: `${line.depth}rem` } : undefined"
              >
                <span v-for="(part, j) in line.parts" :key="j">
                  <OnboardingExplorerAddress
                    v-if="typeof part !== 'string'"
                    :address="part.address"
                    :chain-id="chainId"
                    :label="labelFor(part.address)"
                  />
                  <template v-else>
                    {{ part }}
                  </template>
                </span>
              </li>
            </ul>
          </template>

          <!-- Membership -->
          <p v-else-if="call.description.action === 'assign-roles'" class="queue__line">
            <OnboardingExplorerAddress
              :address="call.description.module ?? ''"
              :chain-id="chainId"
              :label="labelFor(call.description.module)"
            />
            <span
              v-for="membership in call.description.memberships ?? []"
              :key="membership.role"
              class="queue__verdict"
              :class="{ 'queue__verdict--revoke': !membership.added }"
            >
              {{ membership.added ? "added to" : "removed from" }} {{ queuedRoleName(membership.role) }}
            </span>
          </p>
          <p v-else-if="call.description.action === 'set-default-role'" class="queue__line">
            <OnboardingExplorerAddress
              :address="call.description.module ?? ''"
              :chain-id="chainId"
              :label="labelFor(call.description.module)"
            />
            <span class="queue__verdict">acts as {{ queuedRoleName(call.description.role) }} by default</span>
          </p>

          <!-- Allowances -->
          <template v-else-if="call.description.allowance">
            <p class="queue__line">
              <code class="queue__fn">{{ call.description.allowance.key }}</code>
              <span class="queue__verdict">spending allowance</span>
            </p>
            <ul class="queue__limits">
              <li>Balance: {{ call.description.allowance.balance }} (token units)</li>
              <li v-if="refillText(call)">
                {{ refillText(call) }}
              </li>
            </ul>
          </template>

          <!-- Modules and ownership -->
          <p v-else-if="call.description.module" class="queue__line queue__line--warn">
            <OnboardingExplorerAddress
              :address="call.description.module"
              :chain-id="chainId"
              :label="labelFor(call.description.module)"
            />
            <span class="queue__verdict">
              {{ call.description.action === "enable-module" ? "becomes a module of the Roles modifier" : "is removed as a module" }}
            </span>
          </p>
          <p v-else-if="call.description.newOwner" class="queue__line queue__line--warn">
            Ownership of the Roles modifier moves to
            <OnboardingExplorerAddress
              :address="call.description.newOwner"
              :chain-id="chainId"
              :label="labelFor(call.description.newOwner)"
            />
          </p>
          <p v-else class="queue__line queue__line--muted">
            A call to the Roles modifier's <code class="queue__fn">{{ call.name }}</code>
          </p>

          <p v-if="caution(call)" class="queue__caution">
            {{ caution(call) }}
          </p>
          <p
            v-if="notes?.[call.index]"
            class="queue__note"
            :class="{ 'queue__note--warn': notes[call.index].tone === 'warn' }"
          >
            {{ notes[call.index].text }}
          </p>

          <!-- The call as it is: the exact rule, argument by argument, and
               the calldata that will be sent. -->
          <div v-if="isRawOpen(call)" class="queue__raw">
            <p class="queue__raw_call">
              {{ entries[call.index]?.label }}
            </p>
            <template v-if="exactRule(call).length">
              <p class="queue__raw_label">
                Exact rule
              </p>
              <ul class="queue__raw_rule">
                <li
                  v-for="(line, i) in exactRule(call)"
                  :key="i"
                  :class="{ 'queue__raw_rule--muted': line.muted }"
                  :style="line.depth ? { paddingLeft: `${line.depth}rem` } : undefined"
                >
                  {{ line.label ? `${line.label}: ${line.text}` : line.text }}
                </li>
              </ul>
            </template>
            <p v-if="call.description.executionOption" class="queue__raw_option">
              Execution: {{ call.description.executionOption }}
            </p>
            <div class="queue__raw_head">
              <span class="queue__raw_label">Calldata</span>
              <button type="button" class="queue__copy" @click="copyOne(call)">
                {{ copied === call.index ? "Copied" : "Copy" }}
              </button>
            </div>
            <code class="queue__raw_code">{{ entries[call.index]?.data }}</code>
          </div>
        </div>

        <button
          type="button"
          class="queue__call"
          :aria-expanded="isRawOpen(call)"
          :title="`${isRawOpen(call) ? 'Hide' : 'Show'} the raw ${call.name} call`"
          @click="toggleRaw(call)"
        >
          {{ call.name }}
          <Icon
            class="queue__chevron"
            :class="{ 'queue__chevron--open': isRawOpen(call) }"
            icon="material-symbols:keyboard-arrow-down-rounded"
            width="0.875rem"
            height="0.875rem"
          />
        </button>
        <button
          v-if="!lockedSet.has(call.index)"
          type="button"
          class="queue__action"
          :aria-label="`${actionLabel} this ${call.name} call`"
          @click="emit('discard', [call.index])"
        >
          {{ actionLabel }}
        </button>
        <span v-else class="queue__action queue__action--none" aria-hidden="true" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { EXECUTOR_ROLE_KEY_V2 } from "~/composables/nav/generateNAVPermission";
import { getRegistryProtocols } from "~/composables/permissions/protocolPermissions";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import {
  type IQueueGroup,
  type IQueuedCall,
  type QueueGroupKind,
  describeQueuedCalls,
  formatAllowancePeriod,
  groupQueuedCalls,
  queuedRoleName,
} from "~/composables/permissions/rawPermissionQueue";
import { resolveKnownFunction } from "~/composables/proposal/decodeProposalCallData";
import {
  describeConditionTree,
  findExtraSignature,
  formatFunctionLabel,
} from "~/composables/proposal/describeProposalActions";
import { lookupSelectorFragment } from "~/composables/proposal/lookupSelector";
import {
  WELL_KNOWN_LABELS,
  type SummaryLine,
  summarizePermission,
} from "~/composables/proposal/permissionSummary";
import { useFundStore } from "~/store/fund/fund.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Roles modifier calls read back in words: which contracts the role is let
 * into, which functions it may call there and under what limits. Every
 * address links to the chain's explorer. The Permissions step uses it twice:
 * for the raw calls queued to be sent, and for what the modifier already
 * stores.
 *
 * The calls themselves are untouched — this only explains them. Each row is
 * one call and carries its own action.
 */
const props = withDefaults(defineProps<{
  entries: IRawPermissionCodeEntry[];
  /** What the list is: calls waiting to be sent, or what is already stored. */
  title?: string;
  /** The verb on each row's action: "Discard" a queued call, "Remove" a stored one. */
  actionLabel?: string;
  /** A line under a call, by its index: where it came from, what a save does to it. */
  notes?: Record<number, { text: string; tone?: "muted" | "warn" }>;
  /** Calls, by index, that offer no action here. */
  locked?: number[];
  /**
   * The role the surrounding step is about, as the calls print it. Blocks
   * are only tagged with roles other than this one.
   */
  contextRole?: string;
  /**
   * Fold each contract down to its header. For a long list that is read
   * more than it is edited: what the vault already stores.
   */
  collapsible?: boolean;
  chainId?: ChainId;
  /** The vault's own contracts, so they are named instead of shown as hex. */
  vaultAddress?: string;
  safeAddress?: string;
  rolesModAddress?: string;
  baseToken?: string;
}>(), {
  title: "Queued for submission",
  actionLabel: "Discard",
  notes: undefined,
  locked: () => [],
  contextRole: EXECUTOR_ROLE_KEY_V2,
  collapsible: false,
  chainId: undefined,
  vaultAddress: undefined,
  safeAddress: undefined,
  rolesModAddress: undefined,
  baseToken: undefined,
});

const emit = defineEmits<{
  /** Indices into `entries` the row's (or the block's) action was pressed for. */
  (e: "discard", indices: number[]): void;
}>();

const lockedSet = computed(() => new Set(props.locked));

/** The calls of a group that can still be acted on. */
const actionable = (group: IQueueGroup): number[] =>
  group.calls.map((call) => call.index).filter((index) => !lockedSet.value.has(index));

const fundStore = useFundStore();

const GROUP_NAMES: Record<QueueGroupKind, string> = {
  target: "",
  members: "Role members",
  allowances: "Allowances",
  modifier: "Roles modifier",
};

const FUNCTION_ACTIONS = new Set([
  "allow-function",
  "scope-function",
  "revoke-function",
  "scope-parameter",
  "unscope-parameter",
  "set-execution-options",
]);

const calls = computed(() => describeQueuedCalls(props.entries ?? []));
const groups = computed(() => groupQueuedCalls(calls.value));

const summary = computed(() => {
  const contracts = groups.value.filter((group) => group.kind === "target").length;
  const count = calls.value.length;
  return (
    `${count} call${count === 1 ? "" : "s"}` +
    (contracts ? ` on ${contracts} contract${contracts === 1 ? "" : "s"}` : "")
  );
});

/* ---- Folding ---------------------------------------------------------- */

const opened = ref<string[]>([]);
const isOpen = (group: IQueueGroup) =>
  !props.collapsible || opened.value.includes(group.key);
const toggle = (group: IQueueGroup) => {
  opened.value = opened.value.includes(group.key)
    ? opened.value.filter((key) => key !== group.key)
    : [...opened.value, group.key];
};

/** What a folded contract holds, in a few words. */
const groupSummary = (group: IQueueGroup): string => {
  if (group.calls.some((call) => call.description.action === "allow-target")) {
    return "any function";
  }
  const count = grantCount(group);
  if (group.kind === "target") {
    return count ? `${count} function${count === 1 ? "" : "s"}` : "nothing allowed";
  }
  return `${group.calls.length} call${group.calls.length === 1 ? "" : "s"}`;
};

/** Does a pending save change anything in this group? */
const hasWarning = (group: IQueueGroup) =>
  group.calls.some((call) => props.notes?.[call.index]?.tone === "warn");

/** The roles a group names besides the one the step is showing. */
const otherRoles = (group: IQueueGroup) =>
  group.roles.filter((role) => role !== props.contextRole);

/** How many calls of a group actually let a function through. */
const grantCount = (group: IQueueGroup) =>
  group.calls.filter((call) =>
    ["allow-function", "scope-function", "allow-target"].includes(call.description.action),
  ).length;

/* ---- Naming the addresses ------------------------------------------------ */

const explorerLabels = reactive<Record<string, string>>({});
const requestedLabels = new Set<string>();

// The protocols the permissions registry describes on this chain name their
// own contracts and tokens: cheaper and more precise than the explorer.
const registryLabels = computed((): Record<string, string> => {
  if (!props.chainId) return {};
  try {
    const labels: Record<string, string> = {};
    for (const protocol of getRegistryProtocols(props.chainId)) {
      Object.assign(labels, protocol.addressLabels);
    }
    return labels;
  } catch {
    return {};
  }
});

const labelFor = (address?: string): string | undefined => {
  if (!address) return undefined;
  const key = address.toLowerCase();
  const is = (other?: string) => !!other && other.toLowerCase() === key;
  if (is(props.vaultAddress)) return "This vault";
  if (is(props.safeAddress)) return "Vault Safe";
  if (is(props.rolesModAddress)) return "Roles modifier";
  return (
    registryLabels.value[key] ??
    WELL_KNOWN_LABELS[key] ??
    explorerLabels[key] ??
    (is(props.baseToken) ? "Base token" : undefined)
  );
};

/** Ask the explorer for a name where nothing local has one. */
const resolveLabel = (address?: string) => {
  const chainId = props.chainId;
  if (!chainId || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
  const key = address.toLowerCase();
  if (requestedLabels.has(`${chainId}:${key}`) || labelFor(address)) return;
  requestedLabels.add(`${chainId}:${key}`);
  fundStore
    .getAddressLabel(address, chainId)
    .then((label) => {
      if (label) explorerLabels[key] = label;
    })
    .catch(() => undefined);
};

/* ---- Naming the functions ------------------------------------------------ */

interface INamedFunction {
  name: string;
  inputs: ethers.ParamType[];
}

// A permission names a function by its 4-byte selector alone. undefined =
// not asked yet, null = asked and nobody could name it.
const functions = reactive<Record<string, INamedFunction | null>>({});
const functionKey = (target?: string, selector?: string) =>
  `${(target ?? "").toLowerCase()}:${(selector ?? "").toLowerCase()}`;

const toInputs = (inputs: readonly any[]): ethers.ParamType[] => {
  try {
    return inputs.map((input) => ethers.ParamType.from(input));
  } catch {
    return [];
  }
};

const resolveFunction = async (target?: string, selector?: string) => {
  if (!target || !selector) return;
  const key = functionKey(target, selector);
  if (key in functions) return;
  functions[key] = null;

  // The ABIs the app ships (the vault, a Safe, ERC-20, the modifier itself).
  const known = resolveKnownFunction(selector);
  if (known) {
    functions[key] = {
      name: known.function.name,
      inputs: toInputs(known.function.inputs ?? []),
    };
    return;
  }
  const shipped = findExtraSignature(selector);
  if (shipped) {
    functions[key] = { name: shipped.name, inputs: [...shipped.inputs] };
    return;
  }
  // The target's verified ABI on the explorer, which also names arguments.
  if (props.chainId) {
    try {
      const sourceCode = await fundStore.fetchAddressSourceCode(props.chainId, target);
      const fragment = sourceCode?.ABI
        ? new ethers.Interface(JSON.parse(sourceCode.ABI)).getFunction(selector)
        : null;
      if (fragment) {
        functions[key] = { name: fragment.name, inputs: [...fragment.inputs] };
        return;
      }
    } catch {
      // unverified, a proxy, or the explorer is unavailable
    }
  }
  // Last resort: the public signature database (types, no argument names).
  const fragment = await lookupSelectorFragment(selector);
  if (fragment) functions[key] = { name: fragment.name, inputs: [...fragment.inputs] };
};

watch(
  calls,
  (list) => {
    for (const { description } of list) {
      resolveLabel(description.target);
      resolveLabel(description.module);
      resolveLabel(description.newOwner);
      resolveFunction(description.target, description.selector);
    }
  },
  { immediate: true },
);

const namedFunction = (call: IQueuedCall) =>
  functions[functionKey(call.description.target, call.description.selector)] ?? undefined;

const functionLabel = (call: IQueuedCall): string => {
  const named = namedFunction(call);
  return named
    ? formatFunctionLabel(named.name, named.inputs)
    : `function ${call.description.selector ?? "?"}`;
};

/* ---- What each function call allows -------------------------------------- */

const ADDRESS_AT_END = /(0x[0-9a-fA-F]{40})$/;

interface ILimitLine {
  parts: SummaryLine;
  /** Nesting inside a struct or an "any of" group. */
  depth: number;
}

/** A role key printed as hex reads as nothing; print the role's name. */
const withRoleNames = (text: string): string =>
  text.replace(/0x[0-9a-fA-F]{64}/g, (hex) => {
    try {
      const name = ethers.decodeBytes32String(hex);
      return name && /^[\x20-\x7E]+$/.test(name) ? queuedRoleName(name) : hex;
    } catch {
      return hex;
    }
  });

const namePart = (part: SummaryLine[number]) =>
  typeof part === "string" ? withRoleNames(part) : part;

/**
 * The limits on a scoped function, one per line. The plain-language summary
 * knows the common calls (transfers, approvals, lending, bridging). Where it
 * cannot say a limit — a struct argument, a nested rule — the condition tree
 * itself is listed instead, indented as it nests: an approximate sentence is
 * worse than the exact rule.
 */
const limitsOf = (call: IQueuedCall): ILimitLine[] => {
  const { description } = call;
  if (description.action !== "scope-function" && description.action !== "scope-parameter") {
    return [];
  }
  const named = namedFunction(call);
  const hasStructArgument = (named?.inputs ?? []).some(
    (input) => input.baseType === "tuple" || input.arrayChildren?.baseType === "tuple",
  );
  const plain = hasStructArgument
    ? undefined
    : summarizePermission(description, {
      roleName: (role) => queuedRoleName(role),
      label: labelFor,
      inputs: named?.inputs,
      functionName: named?.name,
    });
  const isExact = (line: SummaryLine) =>
    !line.some((part) => typeof part === "string" && part.includes("see the exact rule"));
  if (plain?.lines.length && plain.lines.every(isExact)) {
    return plain.lines.map((line) => ({ parts: line.map(namePart), depth: 0 }));
  }

  const tree = describeConditionTree(description.conditions, named?.inputs).filter(
    (line) => !line.muted,
  );
  return tree
    // A group heading ("must match:") whose members are all unrestricted
    // has nothing under it left to say.
    .filter((line, i) => !line.text.endsWith(":") || (tree[i + 1]?.depth ?? -1) > line.depth)
    .map((line): ILimitLine => {
      const label = line.label.replace(/ \((?:tuple|[a-z0-9[\]]+)[^)]*\)$/, "");
      // A line without a label is a heading ("One of these 9 combinations:").
      const lead = label ? `${label}: ` : "";
      const address = line.text.match(ADDRESS_AT_END)?.[1];
      if (!address) {
        return { parts: [withRoleNames(`${lead}${line.text}`)], depth: line.depth };
      }
      return {
        parts: [`${lead}${line.text.replace(ADDRESS_AT_END, "").trimEnd()} `, { address }],
        depth: line.depth,
      };
    });
};

// Derived once per change rather than per render, and read by the template.
const limits = computed(
  () => new Map(calls.value.map((call) => [call.index, limitsOf(call)])),
);
const limitLines = (call: IQueuedCall): ILimitLine[] => limits.value.get(call.index) ?? [];

// Addresses that only appear inside a limit ("recipient: only 0x…") get
// their names looked up as well.
watch(
  limits,
  (all) => {
    for (const lines of all.values()) {
      for (const line of lines) {
        for (const part of line.parts) {
          if (typeof part !== "string") resolveLabel(part.address);
        }
      }
    }
  },
  { immediate: true },
);

const verdict = (call: IQueuedCall): string => {
  switch (call.description.action) {
    case "allow-function":
      return "any arguments";
    case "scope-function":
      return limitLines(call).length ? "only when" : "any arguments";
    case "revoke-function":
      return "no longer allowed";
    case "scope-parameter":
      return "new limits";
    case "unscope-parameter":
      return "one argument no longer limited";
    case "set-execution-options":
      return call.description.executionOption ?? "";
    default:
      return "";
  }
};

/** ETH or delegatecall allowed with the call: worth stopping at. */
const caution = (call: IQueuedCall): string => {
  const option = call.description.executionOption ?? "";
  if (!["allow-target", "allow-function", "scope-function"].includes(call.description.action)) {
    return "";
  }
  if (option.includes("delegatecall") && !option.startsWith("plain")) {
    return option.includes("ETH")
      ? "Can also send ETH and delegatecall. A delegatecall runs code as the vault's Safe."
      : "Can also delegatecall, which runs code as the vault's Safe.";
  }
  if (option.includes("send ETH") && !option.startsWith("plain")) {
    return "May also attach ETH to the call.";
  }
  return "";
};

/* ---- The raw call --------------------------------------------------------- */

const rawOpen = ref<number[]>([]);
const isRawOpen = (call: IQueuedCall) => rawOpen.value.includes(call.index);
const toggleRaw = (call: IQueuedCall) => {
  rawOpen.value = isRawOpen(call)
    ? rawOpen.value.filter((index) => index !== call.index)
    : [...rawOpen.value, call.index];
};

/**
 * A scoped function's condition tree, every argument listed, the
 * unrestricted ones too: the plain lines above say what matters, this is
 * the whole rule.
 */
const exactRule = (call: IQueuedCall) => {
  const { action, conditions } = call.description;
  if (action !== "scope-function" && action !== "scope-parameter") return [];
  return describeConditionTree(conditions, namedFunction(call)?.inputs).map((line) => ({
    ...line,
    text: withRoleNames(line.text),
  }));
};

const copied = ref<number | "all" | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
const copy = async (text: string, what: number | "all") => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  copied.value = what;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = null), 1500);
};
const copyOne = (call: IQueuedCall) => copy(props.entries[call.index]?.data ?? "", call.index);
const copyAll = () =>
  copy(JSON.stringify(props.entries.map((entry) => entry.data), null, 2), "all");

const refillText = (call: IQueuedCall): string => {
  const allowance = call.description.allowance;
  if (!allowance || allowance.refill === "0") return "No refill: once spent, it is gone";
  const period = formatAllowancePeriod(allowance.period);
  return (
    `Refills ${allowance.refill}` +
    (period ? ` every ${period}` : "") +
    (allowance.maxRefill !== "0" ? `, up to ${allowance.maxRefill}` : "")
  );
};
</script>

<style scoped lang="scss">
.queue {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__head {
    display: flex;
    align-items: baseline;
    gap: 0.625rem;
    margin-top: 0.25rem;
  }

  &__head_action {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__summary {
    font-size: 12px;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__group {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__group_head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 0.875rem;
  }

  &__group_title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem 0.625rem;
    min-width: 0;
    font-size: 13.5px;
    line-height: 1.4;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    padding: 0;
    margin-left: -0.25rem;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  &__chevron {
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__group_summary {
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  &__group_flag {
    font-size: 12px;
    color: $color-warning;
  }

  &__group_name {
    font-weight: 600;
    color: $color-white;
  }

  /* A role other than the one being shown that the block's calls name. */
  &__role {
    padding: 0.125rem 0.4375rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: start;
    gap: 0.875rem;
    padding: 0.5625rem 0.875rem;
    border-top: 1px solid $color-line;
  }

  &__what {
    min-width: 0;
  }

  &__line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    font-size: 13px;
    line-height: 1.5;
    color: $color-white;

    &--muted {
      color: $color-steel-blue;
    }

    &--warn {
      color: $color-warning;
    }

    &--revoke {
      color: $color-neg;
    }
  }

  &__fn {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
    word-break: break-word;
  }

  &__verdict {
    font-size: 12px;
    color: $color-steel-blue;

    &--revoke {
      color: $color-neg;
    }
  }

  &__limits {
    margin: 0.25rem 0 0;
    padding: 0 0 0 0.875rem;
    list-style: none;
    border-left: 1px solid $color-line-2;
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-white;
    word-break: break-word;
  }

  /* Where a stored call came from, or what the pending save does to it. */
  &__note {
    margin-top: 0.25rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;

    &--warn {
      color: $color-warning;
    }
  }

  &__caution {
    margin-top: 0.25rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-warning;
  }

  /* The Roles function behind the row; opens the raw call under it. */
  &__call {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.1875rem 0 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-steel-blue;
    white-space: nowrap;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible,
    &[aria-expanded="true"] {
      outline: none;
      color: $color-white;
    }
  }

  &__copy {
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    white-space: nowrap;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  &__raw {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__raw_call {
    font-family: $font-mono;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-white;
    word-break: break-word;
  }

  &__raw_label {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__raw_rule {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: $font-mono;
    font-size: 11.5px;
    line-height: 1.55;
    color: $color-white;
    word-break: break-word;

    &--muted {
      color: $color-steel-blue;
    }
  }

  &__raw_option {
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__raw_head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__raw_code {
    display: block;
    max-height: 7.5rem;
    overflow: auto;
    padding: 0.5rem 0.625rem;
    border-radius: $default-border-radius;
    background: $color-surface;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.5;
    color: $color-steel-blue;
    word-break: break-all;
    user-select: all;
  }

  &__action {
    flex: none;
    padding: 0.1875rem 0 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    white-space: nowrap;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-neg;
    }

    /* Keeps the grid's last column when a row has no action. */
    &--none {
      cursor: default;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__chevron,
    &__action,
    &__call,
    &__copy {
      transition: none;
    }
  }
}
</style>
