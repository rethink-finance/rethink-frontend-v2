<template>
  <section class="grants">

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
        <!-- Who this role is, in a sentence, and what it adds up to. -->
        <header class="hero">
          <div class="hero__icon" :class="`hero__icon--${current.kind}`">
            <Icon :icon="roleIcon(current)" width="1.5rem" height="1.5rem" />
          </div>
          <div class="hero__text">
            <div class="hero__title">
              <span class="hero__name">{{ current.name }}</span>
              <span class="hero__number">Role {{ current.number }}</span>
              <code class="hero__key" :title="`Role key ${current.keyBytes}`">{{ current.label }}</code>
            </div>
          </div>
          <button
            v-if="manage && isDraft(current)"
            type="button"
            class="hero__remove"
            @click="emit('remove-role', current)"
          >
            Remove role
          </button>
        </header>

        <!-- Members: the wallets that act as this role. -->
        <div class="block">
          <div class="block__head">
            <Icon
              class="block__icon"
              icon="material-symbols:group-outline-rounded"
              width="1.25rem"
              height="1.25rem"
            />
            <div>
              <div class="block__title">
                Members
              </div>
            </div>
          </div>

          <slot v-if="manage && memberEditorKeys?.includes(current.keyBytes)" name="members" :role="current" />
          <template v-else>
            <div v-if="current.members.length" class="members">
              <div
                v-for="member in current.members"
                :key="member"
                class="member"
                :class="{ 'member--off': isDisabled(current, member) }"
              >
                <span class="member__avatar" :style="avatarStyle(member)" aria-hidden="true" />
                <div class="member__text">
                  <div class="member__address">
                    <OnboardingExplorerAddress :address="member" :chain-id="chainId" />
                    <ExecutionCopyAddress :address="member" what="this member's address" />
                  </div>
                  <div class="member__tags">
                    <span v-if="isYou(member)" class="member__tag member__tag--you">You</span>
                    <span v-if="addressLabel(member)" class="member__tag">{{ addressLabel(member) }}</span>
                    <span v-if="isDisabled(current, member)" class="member__tag member__tag--warn">Module disabled</span>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="block__empty">
              Nobody holds this role yet{{ manage ? "." : ". Press Manage permissions to add someone." }}
            </p>
          </template>
          <p v-if="!usableMembers(current) && current.entries.length && current.members.length" class="grants__note grants__note--warn">
            Every member's module is disabled on the modifier, so none of what this role is granted can be used until one is enabled again.
          </p>
        </div>

        <!-- Vault operations: the built-in grants every vault gives this role. -->
        <div v-if="split.grants.length" class="block">
          <div class="block__head">
            <Icon
              class="block__icon"
              icon="material-symbols:tune-rounded"
              width="1.25rem"
              height="1.25rem"
            />
            <div>
              <div class="block__title">
                Vault operations
              </div>
            </div>
          </div>
          <!-- One chip per create-flow switch. Hover says what it does; in manage
               mode a click turns it on or off. -->
          <div class="ops">
            <component
              :is="manage ? 'button' : 'span'"
              v-for="op in operations"
              :key="op.key"
              :type="manage ? 'button' : undefined"
              class="op"
              :class="[`op--${opState(op)}`, { 'op--clickable': manage }]"
              @click="manage && emit('toggle-operation', current, op.key)"
            >
              <Icon :icon="OP_ICONS[opState(op)]" width="0.9375rem" height="0.9375rem" />
              {{ op.label }}
              <v-tooltip activator="parent" location="top" max-width="320">
                <div class="op_tip">
                  <div>{{ op.hint }}</div>
                  <div v-if="opNote(op)" class="op_tip__note">
                    {{ opNote(op) }}
                  </div>
                </div>
              </v-tooltip>
            </component>
          </div>
          <p v-if="manage" class="ops_hint">
            Click an operation to turn it on or off.
          </p>
        </div>

        <!-- Protocol access: every other contract the role may call. -->
        <div class="block">
          <div class="block__head">
            <Icon
              class="block__icon"
              icon="material-symbols:hub-outline-rounded"
              width="1.25rem"
              height="1.25rem"
            />
            <div>
              <div class="block__title">
                Protocol access
              </div>
            </div>
          </div>
          <!-- One row per protocol: its mark, what the role may do there,
               how many of its contracts. Open it for each contract's functions
               and their exact limits. -->
          <div v-if="protocolGroups.length" class="protocols">
            <div
              v-for="group in protocolGroups"
              :key="group.key"
              class="protocol"
              :class="{ 'protocol--open': isProtocolOpen(group) }"
            >
              <div
                class="protocol__head"
                role="button"
                tabindex="0"
                :aria-expanded="isProtocolOpen(group)"
                @click="toggleProtocol(group)"
                @keydown.enter.prevent="toggleProtocol(group)"
              >
                <span class="protocol__logo">
                  <OnboardingProtocolLogo
                    v-if="group.logo && 'protocol' in group.logo"
                    :protocol="group.logo.protocol"
                    :label="group.name"
                    :size="22"
                  />
                  <ExecutionTokenMark
                    v-else-if="group.logo && 'token' in group.logo"
                    :symbol="group.logo.token"
                    size="22px"
                  />
                  <Icon
                    v-else
                    icon="material-symbols:description-outline-rounded"
                    width="1.125rem"
                    height="1.125rem"
                  />
                </span>
                <span class="protocol__name">{{ group.name }}</span>
                <span class="protocol__tags">
                  <span v-for="tag in group.tags" :key="tag" class="protocol__tag">{{ tag }}</span>
                </span>
                <span v-if="isMarked(group)" class="protocol__flag">Marked for removal</span>
                <span class="protocol__count">{{ plural(group.targets.length, "contract") }}</span>
                <button
                  v-if="manage && removableIn(group).length"
                  type="button"
                  class="protocol__remove"
                  @click.stop="emit('remove', current!, split.other, removableIn(group))"
                >
                  Remove
                </button>
                <Icon
                  class="protocol__chevron"
                  :class="{ 'protocol__chevron--open': isProtocolOpen(group) }"
                  icon="material-symbols:keyboard-arrow-down-rounded"
                  width="1.25rem"
                  height="1.25rem"
                />
              </div>
              <OnboardingRawPermissionsQueue
                v-if="isProtocolOpen(group)"
                class="protocol__body"
                title="Contracts"
                collapsible
                function-chips
                action-label="Remove"
                :flag-text="manage && isMarked(group) ? 'has permissions marked for removal' : 'has calls inert until activation'"
                :summary-text="queueSummary(groupEntries(group))"
                :entries="groupEntries(group)"
                :notes="groupNotes(group)"
                :locked="groupLocked(group)"
                :context-role="current.label"
                :chain-id="chainId"
                :vault-address="fundAddress"
                :safe-address="safeAddress"
                :roles-mod-address="rolesModAddress"
                :base-token="baseToken"
                @discard="(indices: number[]) => emit('remove', current!, split.other, indices.map((i) => group.indices[i]))"
              />
            </div>
          </div>
          <p v-if="!protocolGroups.length" class="block__empty">
            No protocol access{{ manage ? " yet. Add some below." : "." }}
          </p>
        </div>

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
  vaultOperationSwitches,
  groupByProtocol,
  type IProtocolGroup,
  type IVaultOperationSwitch,
} from "~/composables/permissions/managePermissions";
import {
  WELL_KNOWN_LABELS,
  contractProtocol,
  type IContractProtocol,
} from "~/composables/contracts/contractNames";
import { getRegistryProtocols } from "~/composables/permissions/protocolPermissions";
import { toRoleKeyBytes32 } from "~/composables/nav/generateNAVPermission";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
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
  /** Vault operations switched in manage mode, by role key: switch key → desired state. */
  operationEdits?: Record<string, Record<string, boolean>>;
  /** The connected wallet, marked "You" among the members. */
  account?: string;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  /** Remove was pressed on these of the role's other permissions (manage mode). */
  (e: "remove", role: IStoredRoleView, entries: IRawPermissionCodeEntry[], indices: number[]): void;
  /** A vault operation's chip was clicked in manage mode. */
  (e: "toggle-operation", role: IStoredRoleView, key: string): void;
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
/* ---- The role panel's words and marks ---------------------------------------- */

const ROLE_ICONS = {
  executor: "material-symbols:bolt-rounded",
  admin: "material-symbols:shield-person-outline-rounded",
  custom: "material-symbols:person-outline-rounded",
} as const;
const roleIcon = (role: IStoredRoleView) => ROLE_ICONS[role.kind];

const isYou = (member: string) =>
  !!props.account && member.toLowerCase() === props.account.toLowerCase();

/** A two-tone mark derived from the address, so members are told apart at a glance. */
const avatarStyle = (address: string) => {
  const hex = address.toLowerCase().replace(/^0x/, "");
  const hue = parseInt(hex.slice(0, 6), 16) % 360;
  const second = (hue + 40 + (parseInt(hex.slice(6, 8), 16) % 80)) % 360;
  return { background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${second} 70% 40%))` };
};

/* ---- Protocol access by protocol ----------------------------------------------- */

// The permissions registry names its own protocols' contracts; the address
// book names the rest; anything else is a contract of its own.
const registryProtocols = computed((): Map<string, IContractProtocol> => {
  const byAddress = new Map<string, IContractProtocol>();
  try {
    for (const protocol of getRegistryProtocols(props.chainId)) {
      for (const address of Object.keys(protocol.addressLabels)) {
        byAddress.set(address.toLowerCase(), {
          key: protocol.protocol,
          name: protocol.label,
          logo: { protocol: protocol.protocol },
        });
      }
    }
  } catch {
    // no registry for this chain
  }
  return byAddress;
});
const protocolOf = (address: string) =>
  registryProtocols.value.get(address.toLowerCase()) ?? contractProtocol(address);
const contractNameOf = (address: string) =>
  addressLabel(address) ??
  WELL_KNOWN_LABELS[address.toLowerCase()] ??
  `${address.slice(0, 6)}…${address.slice(-4)}`;

const protocolGroups = computed(() =>
  groupByProtocol(split.value.other, protocolOf, contractNameOf),
);

const openProtocols = ref<string[]>([]);
const protocolKey = (group: IProtocolGroup) => `${current.value?.keyBytes}:${group.key}`;
const isProtocolOpen = (group: IProtocolGroup) => openProtocols.value.includes(protocolKey(group));
const toggleProtocol = (group: IProtocolGroup) => {
  const key = protocolKey(group);
  openProtocols.value = openProtocols.value.includes(key)
    ? openProtocols.value.filter((open) => open !== key)
    : [...openProtocols.value, key];
};

const groupEntries = (group: IProtocolGroup) => group.indices.map((index) => split.value.other[index]);
/** The role-level notes and locks, re-indexed for one protocol's rows. */
const groupNotes = (group: IProtocolGroup) => {
  if (!current.value) return {};
  const notes = rowNotes(current.value, split.value.other);
  return Object.fromEntries(
    group.indices
      .map((index, local) => [local, notes[index]] as const)
      .filter(([, note]) => !!note),
  );
};
const groupLocked = (group: IProtocolGroup) => {
  if (!current.value) return [];
  const locked = new Set(lockedIn(current.value, split.value.other));
  return group.indices.map((index, local) => (locked.has(index) ? local : -1)).filter((local) => local >= 0);
};
const removableIn = (group: IProtocolGroup) => {
  if (!current.value) return [];
  const removable = new Set(removableIndices(split.value.other));
  const removed = new Set(removedIn(current.value));
  return group.indices.filter((index) => removable.has(index) && !removed.has(index));
};
const isMarked = (group: IProtocolGroup) =>
  !!current.value && group.indices.some((index) => removedIn(current.value!).includes(index));

/* ---- Vault operations ------------------------------------------------------- */

const operations = computed(() =>
  current.value ? vaultOperationSwitches(split.value.grants, current.value.label) : [],
);
type OpState = "on" | "off" | "adding" | "removing";
const OP_ICONS: Record<OpState, string> = {
  on: "material-symbols:check-circle-rounded",
  off: "material-symbols:radio-button-unchecked",
  adding: "material-symbols:add-circle-rounded",
  removing: "material-symbols:do-not-disturb-on-rounded",
};
const opState = (op: IVaultOperationSwitch): OpState => {
  const edit = current.value ? props.operationEdits?.[current.value.keyBytes]?.[op.key] : undefined;
  if (edit === undefined || edit === op.on) return op.on ? "on" : "off";
  return edit ? "adding" : "removing";
};
const SETTINGS_OPS = ["updateMetadata", "manageWhitelist", "changeFeeDestinations"];
const MEMBER_OPS = ["manageExecutorMembers", "transferAdminRole", "selfRevoke"];
/** What the chip's tooltip adds beyond the create flow's description. */
const opNote = (op: IVaultOperationSwitch): string => {
  const state = opState(op);
  if (state === "adding") return "Turned on by the permissions proposal.";
  if (state === "removing") return "Turned off by the permissions proposal.";
  const pending = props.pendingActivation;
  if (op.on && pending?.settings && SETTINGS_OPS.includes(op.key)) {
    return "Inert until governance hands settings authority to the vault's Safe (activation, above).";
  }
  if (op.on && pending?.modifier && MEMBER_OPS.includes(op.key)) {
    return "Inert until governance transfers the Roles modifier to the vault's Safe (activation, above).";
  }
  return op.on ? "" : "Off for this role.";
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

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
    gap: 1.5rem;
    padding: 1.5rem;
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

/* ---- Role panel ---------------------------------------------------------- */

.hero {
  display: flex;
  align-items: flex-start;
  gap: 1rem;

  &__icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 3rem;
    height: 3rem;
    border-radius: 12px;
    border: 1px solid $color-accent-line;
    background: $color-accent-soft;
    color: $color-cyan;

    &--admin {
      border-color: $color-line-2;
      background: $color-card-background;
      color: $color-white;
    }

    &--custom {
      border-style: dashed;
      border-color: $color-line-2;
      background: transparent;
      color: $color-steel-blue;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }

  &__name {
    font-size: 20px;
    font-weight: 700;
    color: $color-white;
  }

  &__number {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__key {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    background: none;
    padding: 0;
  }

  &__about {
    margin: 0;
    max-width: 70ch;
    font-size: 13.5px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__remove {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-warning;

    &:hover {
      text-decoration: underline;
    }
  }
}

/* One section of the panel: an icon, a title, a line on what it is. */
.block {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  &__icon {
    flex: none;
    margin-top: 0.0625rem;
    color: $color-cyan;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: $color-white;
  }

  &__help {
    margin: 0.125rem 0 0;
    max-width: 72ch;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__empty {
    margin: 0;
    padding: 0.875rem 1rem;
    border: 1px dashed $color-line-2;
    border-radius: $default-border-radius;
    font-size: 13px;
    color: $color-steel-blue;
  }
}

/* Members as cards: a mark to tell them apart, the address, what it is. */
.members {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.member {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem 0.375rem 0.4375rem;
  border: 1px solid $color-line;
  border-radius: 999px;
  background: $color-card-background;

  &--off {
    opacity: 0.6;
  }

  &__avatar {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 999px;
  }

  &__text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  &__address {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 12.5px;

    :deep(.explorer_address__hex) {
      color: $color-white;
      font-size: 12.5px;
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;

    &:empty {
      display: none;
    }
  }

  &__tag {
    font-family: $font-mono;
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.0625rem 0.3125rem;
    border-radius: 3px;
    border: 1px solid $color-line-2;
    color: $color-steel-blue;

    &--you {
      border-color: $color-accent-line;
      background: $color-accent-soft;
      color: $color-cyan;
    }

    &--warn {
      border-color: currentColor;
      color: $color-warning;
    }
  }
}

/* Vault operations: one chip per switch, its state in its mark. */
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.op {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem 0.4375rem 0.5625rem;
  border-radius: 999px;
  border: 1px solid $color-line-2;
  background: transparent;
  font-size: 12.5px;
  line-height: 1;
  color: $color-white;
  cursor: default;
  transition: border-color $default-transition-time ease, background-color $default-transition-time ease;

  &--on :deep(svg) {
    color: $color-pos;
  }

  &--off {
    color: $color-steel-blue;
    border-style: dashed;

    :deep(svg) {
      color: $color-inactive;
    }
  }

  &--adding {
    border-color: $color-accent-line;
    background: $color-accent-soft;

    :deep(svg) {
      color: $color-cyan;
    }
  }

  &--removing {
    border-color: $color-warning;
    color: $color-warning;
    text-decoration: line-through;

    :deep(svg) {
      color: $color-warning;
    }
  }

  &--clickable {
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-cyan;
    }
  }
}

/* Protocol access: one row per protocol, opening onto its contracts. */
.protocols {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.protocol {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;
  transition: border-color $default-transition-time ease;

  &--open {
    border-color: $color-line-2;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;

      .protocol__name {
        color: $color-cyan;
      }
    }
  }

  &__logo {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.375rem;
    height: 1.375rem;
    color: $color-steel-blue;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
    white-space: nowrap;
    transition: color $default-transition-time ease;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.375rem;
    margin-left: auto;
  }

  &__tag {
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1;
    padding: 0.3125rem 0.5rem;
    border-radius: 4px;
    background: $color-accent-soft;
    color: $color-white;
    white-space: nowrap;
  }

  &__flag {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-warning;
    white-space: nowrap;
  }

  &__count {
    min-width: 5.5rem;
    text-align: right;
    font-size: 12px;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__remove {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &:hover {
      color: $color-warning;
    }
  }

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__body {
    padding: 0 1rem 1rem;
    border-top: 1px solid $color-line;
    padding-top: 0.75rem;
  }

  @media (max-width: 640px) {
    &__head {
      flex-wrap: wrap;
    }

    &__tags {
      order: 5;
      width: 100%;
      justify-content: flex-start;
      margin-left: 0;
    }
  }
}

.ops_hint {
  margin: 0;
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
}

.op_tip {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 12.5px;
  line-height: 1.45;

  &__note {
    opacity: 0.8;
    font-style: italic;
  }
}
</style>
