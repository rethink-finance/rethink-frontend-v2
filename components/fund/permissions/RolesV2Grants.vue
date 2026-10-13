<template>
  <section class="grants">
    <header class="grants__head">
      <div class="grants__intro">
        <div class="brand_card__eyebrow">
          Granted permissions
        </div>
        <p class="grants__lede">
          What each role is allowed to call through the vault's Safe, rebuilt
          from the Roles modifier's on-chain history<template v-if="lastEventBlock">
            (its latest event is in block {{ lastEventBlock.toLocaleString("en-US") }})</template>.
        </p>
      </div>
      <button
        type="button"
        class="grants__refresh"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        {{ isLoading ? "Reading…" : "Refresh" }}
      </button>
    </header>

    <p v-if="!logs && isLoading" class="grants__status">
      Reading the modifier's history…
    </p>
    <p v-else-if="!logs && error" class="grants__status grants__status--error">
      {{ error }} The permissions cannot be shown until a read succeeds.
    </p>

    <template v-else-if="logs">
      <p v-if="error" class="grants__status grants__status--error">
        {{ error }} Showing the last read.
      </p>
      <p v-if="layout.failed" class="grants__status grants__status--error">
        The permissions could not be laid out from the modifier's history.
        Open them in the Roles app (View vault permissions, above).
      </p>
      <p v-else-if="!roles.length" class="grants__status">
        No role on this vault's Roles modifier is held by anyone or let into
        any contract.
      </p>

      <!-- One role on screen at a time, as on the create flow's Permissions
           step: the tabs are the map of the vault's roles. -->
      <div
        v-if="roles.length"
        class="grants__tabs"
        role="tablist"
        aria-label="Vault roles"
      >
        <button
          v-for="role in roles"
          :key="role.keyBytes"
          type="button"
          role="tab"
          class="grants__tab"
          :class="{ 'grants__tab--active': !addingRole && role.keyBytes === current?.keyBytes }"
          :aria-selected="!addingRole && role.keyBytes === current?.keyBytes"
          @click="selectRole(role.keyBytes)"
        >
          <span class="grants__tab_number">Role {{ role.number }}</span>
          <span class="grants__tab_name">{{ role.name }}</span>
        </button>
        <button
          v-if="manage"
          type="button"
          class="grants__tab grants__tab--add"
          :class="{ 'grants__tab--active': addingRole }"
          :aria-expanded="addingRole"
          @click="addingRole = !addingRole"
        >
          <Icon icon="material-symbols:add-rounded" width="1rem" height="1rem" />
          <span class="grants__tab_name">Add role</span>
        </button>
      </div>

      <slot v-if="manage && addingRole" name="add-role" :done="(key: string) => selectRole(key)" />

      <section v-else-if="current" :key="current.keyBytes" class="grants__role">
        <header class="grants__role_head">
          <div class="grants__role_identity">
            <span class="grants__role_name">{{ current.name }}</span>
            <span class="grants__role_tagline">{{ taglineOf(current) }}</span>
          </div>
          <div class="grants__role_meta">
            <code class="grants__role_key" :title="`Role key ${current.keyBytes}`">{{ current.label }}</code>
            <span class="grants__role_counts">{{ countsText(current) }}</span>
            <button
              v-if="manage && isDraft(current)"
              type="button"
              class="grants__role_remove"
              @click="emit('remove-role', current)"
            >
              Remove role
            </button>
          </div>
        </header>

        <slot v-if="memberEditorKeys?.includes(current.keyBytes)" name="members" :role="current" />
        <template v-else>
          <p v-if="current.members.length" class="grants__members">
            <span class="grants__members_label">Held by</span>
            <span
              v-for="member in current.members"
              :key="member"
              class="grants__member"
            >
              <OnboardingExplorerAddress
                :address="member"
                :chain-id="chainId"
                :label="addressLabel(member)"
              />
              <span v-if="isDisabled(current, member)" class="grants__member_flag">
                module disabled: its calls are refused
              </span>
            </span>
          </p>
        </template>
        <p v-if="!usableMembers(current) && current.entries.length" class="grants__note grants__note--warn">
          {{
            current.members.length
              ? "Every member's module is disabled on the modifier, so none of what this role is granted can be used until one is enabled again."
              : "Nobody holds this role, so none of what it is granted can be used until someone is added to it."
          }}
        </p>

        <!-- The vault's own grants, as the create flow's switches made them. -->
        <div v-if="split.grants.length" class="grants__section">
          <button
            type="button"
            class="grants__section_head"
            :class="{ 'grants__section_head--open': prepopulatedOpen }"
            :aria-expanded="prepopulatedOpen"
            @click="prepopulatedOpen = !prepopulatedOpen"
          >
            <Icon
              class="grants__chevron"
              :class="{ 'grants__chevron--open': prepopulatedOpen }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
            <span class="grants__section_title">Prepopulated permissions</span>
            <span class="grants__section_summary">{{ grantedCount }} of {{ split.grants.length }} granted</span>
            <span v-if="prepopulatedMarked" class="grants__section_flag">
              {{ prepopulatedMarked }} marked for removal
            </span>
          </button>
          <div
            v-for="grant in prepopulatedOpen ? split.grants : []"
            :key="grantKey(grant)"
            class="grants__prepop"
            :class="{
              'grants__prepop--off': !grant.granted,
              'grants__prepop--removed': isPrepopulatedRemoved(grant),
            }"
          >
            <div class="grants__prepop_main">
              <span class="grants__prepop_dot" />
              <span class="grants__prepop_label">{{ grant.label }}</span>
              <OnboardingInfoTip
                v-if="grant.hint"
                :text="grant.hint"
                :label="`About “${grant.label}”`"
                align="left"
              />
              <span class="grants__prepop_state">{{ prepopulatedState(grant) }}</span>
              <button
                v-if="manage && grant.granted"
                type="button"
                class="grants__prepop_action"
                @click="emit('toggle-prepopulated', current, grant.scope)"
              >
                {{ isPrepopulatedRemoved(grant) ? "Undo" : "Remove" }}
              </button>
            </div>
            <div v-if="grant.switches" class="grants__prepop_switches">
              <span
                v-for="option in grant.switches"
                :key="option.label"
                class="grants__switch"
                :class="{ 'grants__switch--on': option.on }"
              >{{ option.on ? "✓" : "–" }} {{ option.label }}</span>
            </div>
            <p v-if="grant.granted && prepopulatedInertNote(grant)" class="grants__prepop_note">
              {{ prepopulatedInertNote(grant) }}
            </p>
          </div>
        </div>

        <!-- Everything else the role stores: protocols, raw grants. -->
        <OnboardingRawPermissionsQueue
          v-if="split.other.length"
          :key="`other:${current.keyBytes}`"
          :title="split.grants.length ? 'Other permissions' : 'Permissions'"
          collapsible
          action-label="Remove"
          :flag-text="manage && removedIn(current).length ? 'has permissions marked for removal' : 'has calls inert until activation'"
          :summary-text="queueSummary(split.other)"
          :entries="split.other"
          :notes="rowNotes(current, split.other)"
          :locked="lockedIn(current, split.other)"
          :context-role="current.label"
          :chain-id="chainId"
          :vault-address="fundAddress"
          :safe-address="safeAddress"
          :roles-mod-address="rolesModAddress"
          :base-token="baseToken"
          @discard="(indices: number[]) => emit('remove', current!, split.other, indices)"
        />
        <p v-else-if="!split.grants.length" class="grants__status">
          Nothing is granted to this role{{ manage ? " yet. Add permissions below." : "." }}
        </p>

        <slot v-if="manage" name="additions" :role="current" />
      </section>

      <!-- Spending budgets the roles' limits draw on. They live on the
           modifier, not on a role, and their balance moves with every use,
           so it is read live rather than replayed. -->
      <section v-if="allowances.length" class="grants__extra">
        <div class="grants__extra_title">
          Allowances
        </div>
        <div
          v-for="allowance in allowances"
          :key="allowance.key"
          class="grants__extra_row"
        >
          <p class="grants__extra_line">
            <code class="grants__role_key" :title="`Allowance key ${allowance.key}`">{{ allowance.name }}</code>
            <span :class="{ 'grants__extra_warn': balance(allowance).warn }">{{ balance(allowance).text }}</span>
          </p>
          <p v-if="refillText(allowance)" class="grants__extra_sub">
            {{ refillText(allowance) }}
          </p>
          <p class="grants__extra_sub">
            {{ usedByText(allowance) }}
          </p>
        </div>
      </section>

      <!-- Batch unwrapping applies to every role: a batch sent through the
           modifier is split, and each call inside is checked on its own. -->
      <section v-if="adapters.length" class="grants__extra">
        <div class="grants__extra_title">
          Batches
        </div>
        <p
          v-for="adapter in adapters"
          :key="`${adapter.to}:${adapter.selector}`"
          class="grants__extra_line"
        >
          <code class="grants__role_key" :title="adapter.selector">{{ adapterFunctionName(adapter.selector) }}</code>
          <span>calls to</span>
          <OnboardingExplorerAddress
            :address="adapter.to"
            :chain-id="chainId"
            :label="addressLabel(adapter.to)"
          />
          <span>are split by</span>
          <OnboardingExplorerAddress :address="adapter.adapter" :chain-id="chainId" />
          <span>and every call inside is checked against the sending role's permissions.</span>
        </p>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { resolveKnownFunction } from "~/composables/proposal/decodeProposalCallData";
import {
  findExtraSignature,
  formatRoleKey,
  MULTISEND_SELECTOR,
} from "~/composables/proposal/describeProposalActions";
import { lookupSelectorFragment } from "~/composables/proposal/lookupSelector";
import {
  describeQueuedCalls,
  formatAllowancePeriod,
} from "~/composables/permissions/rawPermissionQueue";
import {
  accrueAllowance,
  storedAllowanceKeys,
  storedUnwrapAdapters,
  type IRoleScopeLog,
  type IRolesAllowance,
} from "~/composables/permissions/roleScopeLogs";
import { UPDATE_SETTINGS_SELECTOR } from "~/composables/permissions/rolesV2Permissions";
import {
  buildStoredRoleViews,
  type AllowanceUse,
  type IStoredRoleView,
} from "~/composables/permissions/storedRoleGrants";
import { useLiveAllowances } from "~/composables/permissions/useLiveAllowances";
import {
  orderRolesForDisplay,
  removableIndices,
  splitPrepopulated,
  type IPrepopulatedGrant,
} from "~/composables/permissions/managePermissions";
import { toRoleKeyBytes32 } from "~/composables/nav/generateNAVPermission";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import type { IPermissionScope } from "~/composables/permissions/revokePermissions";
import { VAULT_ROLES } from "~/composables/permissions/vaultRoles";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * A Roles V2 vault's permissions as they stand: every live role, who holds
 * it, and what it may call on which contract under which limits — plus the
 * allowances and batch unwrappers the modifier applies to all of them.
 *
 * Reads nothing but the allowance balances itself: the page hands it the
 * modifier's event log, which it also uses for membership and activation.
 */
const props = defineProps<{
  chainId: ChainId;
  fundAddress: string;
  safeAddress?: string;
  rolesModAddress: string;
  baseToken?: string;
  /** The modifier's full event log; null until a read has succeeded. */
  logs: IRoleScopeLog[] | null;
  isLoading?: boolean;
  /** Why the last read failed, or "". */
  error?: string;
  /**
   * What the one-time activation still has to hand to the Safe. Until it
   * does, grants that need it pass the Roles check and then revert.
   */
  pendingActivation?: { modifier: boolean; settings: boolean };
  /** Manage mode: stored grants offer Remove, and the additions slot shows. */
  manage?: boolean;
  /** Stored calls marked for removal, by role key (lowercase bytes32). */
  removals?: Record<string, number[]>;
  /** Roles (lowercase bytes32) whose members the page lists itself, through the members slot. */
  memberEditorKeys?: string[];
  /** Custom roles named on this page that the modifier does not know yet. */
  draftRoles?: IStoredRoleView[];
  /** The tab on screen (lowercase bytes32); the executor until one is picked. */
  selectedKey?: string;
  /** The executor's key as this vault spells it, for its prepopulated grants. */
  executorRoleKey: string;
  /** Prepopulated grants marked for removal, by role key, as "target:selector". */
  prepopulatedRemovals?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  /** Remove was pressed on these of the role's other permissions (manage mode). */
  (e: "remove", role: IStoredRoleView, entries: IRawPermissionCodeEntry[], indices: number[]): void;
  /** Remove (or Undo) on one of the role's prepopulated grants. */
  (e: "toggle-prepopulated", role: IStoredRoleView, scope: IPermissionScope): void;
  (e: "remove-role", role: IStoredRoleView): void;
  (e: "update:selectedKey", key: string): void;
}>();

/* ---- The roles ------------------------------------------------------------ */

// A fold that throws must not read as "nothing is granted".
const layout = computed((): { views: IStoredRoleView[]; failed: boolean } => {
  if (!props.logs) return { views: [], failed: false };
  try {
    return { views: buildStoredRoleViews(props.logs), failed: false };
  } catch (error) {
    console.error("Could not lay out the stored permissions", error);
    return { views: [], failed: true };
  }
});
// By role number (admin, executor, then custom roles, stored or only named
// so far). The executor's tab is the one that opens first.
const roles = computed(() => {
  const stored = orderRolesForDisplay(layout.value.views);
  const known = new Set(stored.map((role) => role.keyBytes));
  return [...stored, ...(props.draftRoles ?? []).filter((role) => !known.has(role.keyBytes))];
});

/* ---- Tabs ------------------------------------------------------------------ */

const addingRole = ref(false);
watch(() => props.manage, (manage) => { if (!manage) addingRole.value = false; });
const selectRole = (key: string) => {
  addingRole.value = false;
  emit("update:selectedKey", key);
};
const executorKeyBytes = computed(() => toRoleKeyBytes32(props.executorRoleKey).toLowerCase());
const current = computed(
  () =>
    roles.value.find((role) => role.keyBytes === props.selectedKey) ??
    roles.value.find((role) => role.keyBytes === executorKeyBytes.value) ??
    roles.value[0],
);
const isDraft = (role: IStoredRoleView) =>
  (props.draftRoles ?? []).some((draft) => draft.keyBytes === role.keyBytes) &&
  !layout.value.views.some((view) => view.keyBytes === role.keyBytes);

const taglineOf = (role: IStoredRoleView) =>
  role.kind === "admin"
    ? VAULT_ROLES.admin.tagline
    : role.kind === "executor"
      ? VAULT_ROLES.executor.tagline
      : "Custom role. It may do what is granted to it below.";

/* ---- Prepopulated and other permissions ------------------------------------ */

const contracts = computed(() => ({
  fundAddress: props.fundAddress,
  baseToken: props.baseToken ?? "",
  rolesModifier: props.rolesModAddress,
}));
const split = computed(() =>
  current.value
    ? splitPrepopulated(current.value.entries, current.value.label, contracts.value, props.executorRoleKey)
    : { grants: [], prepopulated: [], other: [] },
);
const grantedCount = computed(() => split.value.grants.filter((grant) => grant.granted).length);
// Folded by default: the vault's built-in grants rarely change and the role's
// other permissions are what is read most.
const prepopulatedOpen = ref(false);
const prepopulatedMarked = computed(
  () => split.value.grants.filter((grant) => isPrepopulatedRemoved(grant)).length,
);
const grantKey = (grant: IPrepopulatedGrant) =>
  `${grant.scope.target.toLowerCase()}:${grant.scope.selector.toLowerCase()}`;
const isPrepopulatedRemoved = (grant: IPrepopulatedGrant) =>
  !!current.value &&
  (props.prepopulatedRemovals?.[current.value.keyBytes] ?? []).includes(grantKey(grant));
const prepopulatedState = (grant: IPrepopulatedGrant) => {
  if (!grant.granted) return "Not granted";
  return isPrepopulatedRemoved(grant) ? "Marked for removal" : "Granted";
};
const prepopulatedInertNote = (grant: IPrepopulatedGrant): string => {
  const pending = props.pendingActivation;
  if (!pending) return "";
  if (pending.settings && grant.scope.selector.toLowerCase() === UPDATE_SETTINGS_SELECTOR) {
    return "Inert until governance hands settings authority to the vault's Safe (activation, above).";
  }
  if (pending.modifier && grant.scope.target.toLowerCase() === props.rolesModAddress.toLowerCase()) {
    return "Inert until governance transfers the Roles modifier to the vault's Safe (activation, above).";
  }
  return "";
};

const lastEventBlock = computed(() =>
  (props.logs ?? []).reduce((max, log) => Math.max(max, log.blockNumber || 0), 0),
);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const countsText = (role: IStoredRoleView): string => {
  const parts = [
    plural(role.members.length, "member"),
    plural(role.contracts, "contract"),
    plural(role.functions, "function"),
  ];
  if (role.openContracts) parts.push(`${role.openContracts} open to any function`);
  return parts.join(" · ");
};

// The queue counts Roles calls; say what they allow instead. Functions are
// only ever allowed on the contracts that are not open to any function.
const queueSummary = (entries: IRawPermissionCodeEntry[]): string => {
  const calls = describeQueuedCalls(entries);
  const functions = calls.filter((call) => ["allow-function", "scope-function"].includes(call.description.action)).length;
  const open = calls.filter((call) => call.description.action === "allow-target").length;
  const scoped = calls.filter((call) => call.description.action === "scope-target").length;
  const parts: string[] = [];
  if (functions) parts.push(`${plural(functions, "function")} on ${plural(scoped, "contract")}`);
  if (open) parts.push(`any function on ${plural(open, "contract")}`);
  return parts.join(", ");
};

/* ---- Manage mode ----------------------------------------------------------- */

const removedIn = (role: IStoredRoleView): number[] => props.removals?.[role.keyBytes] ?? [];

/** Outside manage mode nothing offers an action; inside, only grants not yet marked do. */
const lockedIn = (role: IStoredRoleView, entries: IRawPermissionCodeEntry[]): number[] => {
  if (!props.manage) return entries.map((_, i) => i);
  const removable = new Set(removableIndices(entries));
  const removed = new Set(removedIn(role));
  return entries.map((_, i) => i).filter((i) => !removable.has(i) || removed.has(i));
};

const REMOVED_NOTE = {
  text: "Marked for removal: the permissions proposal below takes this away.",
  tone: "warn" as const,
};
const rowNotes = (role: IStoredRoleView, entries: IRawPermissionCodeEntry[]) => {
  const notes = { ...inertNotes(entries) };
  if (props.manage) for (const index of removedIn(role)) notes[index] = REMOVED_NOTE;
  return notes;
};

const isDisabled = (role: IStoredRoleView, member: string) =>
  role.disabledMembers.includes(member);
const usableMembers = (role: IStoredRoleView) =>
  role.members.length - role.disabledMembers.length;

const addressLabel = (address: string): string | undefined => {
  const lower = address.toLowerCase();
  if (props.safeAddress && lower === props.safeAddress.toLowerCase()) return "Vault Safe";
  if (lower === props.fundAddress.toLowerCase()) return "This vault";
  if (lower === props.rolesModAddress.toLowerCase()) return "Roles modifier";
  return undefined;
};

const MODIFIER_INERT =
  "Inert until activation: the Roles modifier is not owned by the vault's " +
  "Safe yet, so this call reverts until governance transfers its ownership " +
  "to the Safe.";
const SETTINGS_INERT =
  "Inert until activation: the vault takes settings changes only from its " +
  "governor, so this call reverts until governance hands settings authority " +
  "to the Safe.";
const SETTINGS_INERT_WILDCARD =
  "Settings changes (updateSettings) through this grant revert until " +
  "governance hands settings authority to the Safe; its other functions are " +
  "not affected.";

/** Grants that pass the Roles check today but revert at their target. */
const inertNotes = (entries: IRawPermissionCodeEntry[]) => {
  const pending = props.pendingActivation;
  const notes: Record<number, { text: string; tone: "warn" }> = {};
  if (!pending?.modifier && !pending?.settings) return notes;
  for (const { index, description } of describeQueuedCalls(entries)) {
    if (!["allow-target", "allow-function", "scope-function"].includes(description.action)) {
      continue;
    }
    const target = (description.target ?? "").toLowerCase();
    if (pending.modifier && target === props.rolesModAddress.toLowerCase()) {
      notes[index] = { text: MODIFIER_INERT, tone: "warn" };
    } else if (pending.settings && target === props.fundAddress.toLowerCase()) {
      if (description.action === "allow-target") {
        notes[index] = { text: SETTINGS_INERT_WILDCARD, tone: "warn" };
      } else if ((description.selector ?? "").toLowerCase() === UPDATE_SETTINGS_SELECTOR) {
        notes[index] = { text: SETTINGS_INERT, tone: "warn" };
      }
    }
  }
  return notes;
};

/* ---- Allowances ------------------------------------------------------------ */

interface IAllowanceRow {
  key: string;
  name: string;
  /** How the roles that name it draw it down, and which roles those are. */
  uses: { use: AllowanceUse; role: string }[];
  /** The stored allowance: undefined while reading, null when the read failed. */
  live?: IRolesAllowance | null;
}

// Every allowance the modifier has set, then any a role's limits name
// without one ever being set (it then holds nothing).
const allowanceKeys = computed((): string[] => {
  if (!props.logs) return [];
  const keys = storedAllowanceKeys(props.logs);
  for (const role of roles.value) {
    for (const { key } of role.allowances) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
});

const { liveAllowance } = useLiveAllowances(() => ({
  chainId: props.chainId,
  rolesModAddress: props.rolesModAddress,
  keys: allowanceKeys.value,
  logs: props.logs,
}));

const allowances = computed((): IAllowanceRow[] =>
  allowanceKeys.value.map((key) => ({
    key,
    name: formatRoleKey(key),
    uses: roles.value.flatMap((role) =>
      role.allowances
        .filter((allowance) => allowance.key === key)
        .map(({ use }) => ({ use, role: `Role ${role.number} · ${role.name}` })),
    ),
    live: liveAllowance(key),
  })),
);

/** An amount in the units the allowance is drawn down in. */
const amountText = (amount: bigint, row: IAllowanceRow): string => {
  const use = row.uses[0]?.use;
  if (use === "ether") {
    // Truncated, never rounded up: a balance must not read larger than it is.
    const [whole, fraction = ""] = ethers.formatEther(amount).split(".");
    const digits = fraction.slice(0, 6).replace(/0+$/, "");
    return `${BigInt(whole).toLocaleString("en-US")}${digits ? `.${digits}` : ""} ETH`;
  }
  if (use === "calls") return plural(Number(amount), "call");
  return `${amount.toLocaleString("en-US")} (in the limited argument's units)`;
};

const UINT128_MAX = (1n << 128n) - 1n;

const balance = (row: IAllowanceRow): { text: string; warn?: boolean } => {
  if (row.live === undefined) return { text: "reading its balance…" };
  if (row.live === null) return { text: "its balance could not be read right now", warn: true };
  const left = accrueAllowance(row.live, BigInt(Math.floor(Date.now() / 1000)));
  if (left === null) {
    return {
      text: "unusable: its refill overflows the modifier's arithmetic, so every call drawing on it reverts",
      warn: true,
    };
  }
  return { text: `${amountText(left, row)} left` };
};

const refillText = (row: IAllowanceRow): string => {
  const live = row.live;
  if (!live) return "";
  if (live.refill === 0n || live.period === 0n) return "Does not refill: once spent, it is gone.";
  const period = formatAllowancePeriod(String(live.period));
  return (
    `Refills by ${amountText(live.refill, row)} every ${period}` +
    (live.maxRefill >= UINT128_MAX ? "." : `, up to ${amountText(live.maxRefill, row)}.`)
  );
};

const usedByText = (row: IAllowanceRow): string => {
  if (!row.uses.length) return "No role's limits draw on it.";
  const roleNames = [...new Set(row.uses.map((use) => use.role))];
  return `Drawn on by ${roleNames.join(", ")}.`;
};

/* ---- Batch unwrappers ------------------------------------------------------ */

const adapters = computed(() => (props.logs ? storedUnwrapAdapters(props.logs) : []));

const knownFunctionName = (selector: string): string | undefined => {
  if (selector === MULTISEND_SELECTOR) return "multiSend";
  return resolveKnownFunction(selector)?.function.name ?? findExtraSignature(selector)?.name;
};

// Names the shipped ABIs do not have, looked up once per selector.
const lookedUpNames = reactive<Record<string, string>>({});
watch(
  adapters,
  (list) => {
    for (const { selector } of list) {
      const key = selector.toLowerCase();
      if (key in lookedUpNames || knownFunctionName(key)) continue;
      lookedUpNames[key] = "";
      lookupSelectorFragment(key)
        .then((fragment) => {
          if (fragment) lookedUpNames[key] = fragment.name;
        })
        .catch(() => undefined);
    }
  },
  { immediate: true },
);

const adapterFunctionName = (selector: string): string => {
  const key = selector.toLowerCase();
  return knownFunctionName(key) || lookedUpNames[key] || selector;
};
</script>

<style scoped lang="scss">
.grants {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__intro {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__lede {
    margin: 0;
    max-width: 68ch;
    font-size: 12.5px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__refresh {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.3125rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    transition: color $default-transition-time, border-color $default-transition-time;

    &:hover:not(:disabled) {
      color: $color-white;
      border-color: $color-accent-line;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
  }

  &__status {
    margin: 0;
    font-size: 13px;
    color: $color-steel-blue;

    &--error {
      color: $color-warning;
    }
  }

  /* The role tabs, as on the create flow's Permissions step. */
  &__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem 0.5rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    color: $color-steel-blue;
    cursor: pointer;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
      border-color: $color-line-3;
    }

    &--active,
    &--active:hover,
    &--active:focus-visible {
      border-color: $color-accent-line;
      background: $color-accent-soft;
      color: $color-white;
    }

    &--add {
      gap: 0.25rem;
      padding-left: 0.5rem;
      border-style: dashed;
    }
  }

  &__tab_number {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__tab--active &__tab_number {
    color: $color-cyan;
  }

  &__tab_name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }

  /* The role on screen. */
  &__role {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__role_identity {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__role_tagline {
    font-size: 12.5px;
    color: $color-steel-blue;
  }

  &__role_meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.875rem;
    margin-left: auto;
  }

  &__role_remove {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-warning;

    &:hover {
      text-decoration: underline;
    }
  }

  /* Prepopulated permissions: one row per built-in grant. */
  &__section {
    display: flex;
    flex-direction: column;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
  }

  &__section_head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 0.625rem;
    text-align: left;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;

      .grants__section_title {
        color: $color-cyan;
      }
    }

    &--open {
      border-bottom: 1px solid $color-line;
    }
  }

  &__chevron {
    flex: none;
    transition: transform $default-transition-time;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__section_flag {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-warning;
  }

  &__section_title {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
  }

  &__section_summary {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }

  &__prepop {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 1rem;

    & + & {
      border-top: 1px solid $color-line;
    }
  }

  &__prepop_main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    color: $color-white;
  }

  &__prepop_dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex: none;
    background: $color-pos;
  }

  &__prepop--off &__prepop_dot {
    background: $color-inactive;
  }

  &__prepop--off &__prepop_label {
    color: $color-steel-blue;
  }

  &__prepop--removed &__prepop_dot {
    background: $color-warning;
  }

  &__prepop_state {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }

  &__prepop--removed &__prepop_state {
    color: $color-warning;
  }

  &__prepop_action {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &:hover {
      color: $color-white;
    }
  }

  &__prepop_switches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding-left: 1.0625rem;
  }

  &__switch {
    font-size: 12px;
    color: $color-steel-blue;

    &--on {
      color: $color-white;
    }
  }

  &__prepop_note {
    margin: 0;
    padding-left: 1.0625rem;
    font-size: 12px;
    color: $color-warning;
  }

  &__role_head {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }

  &__role_number {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__role_name {
    font-size: 16px;
    font-weight: 700;
    color: $color-white;
  }

  &__role_key {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  &__role_counts {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }

  &__members {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
    margin: 0;
    font-size: 13px;
    color: $color-white;
  }

  &__members_label {
    color: $color-steel-blue;
  }

  &__member {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__member_flag {
    font-size: 12px;
    color: $color-warning;
  }

  &__note {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0;
    font-size: 12.5px;
    color: $color-steel-blue;

    &--warn {
      color: $color-warning;
    }
  }

  &__extra {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding-top: 1.25rem;
    border-top: 1px solid $color-line;
  }

  &__extra_title {
    font-size: 14px;
    font-weight: 700;
    color: $color-white;
  }

  &__extra_row {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__extra_line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0;
    font-size: 13px;
    color: $color-white;
  }

  &__extra_warn {
    color: $color-warning;
  }

  &__extra_sub {
    margin: 0;
    font-size: 12.5px;
    color: $color-steel-blue;
  }
}
</style>
