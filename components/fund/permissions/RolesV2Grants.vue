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

      <section
        v-for="role in roles"
        :key="role.keyBytes"
        class="grants__role"
      >
        <header class="grants__role_head">
          <span class="grants__role_number">Role {{ role.number }}</span>
          <span class="grants__role_name">{{ role.name }}</span>
          <code class="grants__role_key" :title="`Role key ${role.keyBytes}`">{{ role.label }}</code>
          <span class="grants__role_counts">{{ countsText(role) }}</span>
        </header>

        <p v-if="role.members.length" class="grants__members">
          <span class="grants__members_label">Held by</span>
          <span
            v-for="member in role.members"
            :key="member"
            class="grants__member"
          >
            <OnboardingExplorerAddress
              :address="member"
              :chain-id="chainId"
              :label="addressLabel(member)"
            />
            <span v-if="isDisabled(role, member)" class="grants__member_flag">
              module disabled: its calls are refused
            </span>
          </span>
        </p>
        <p v-if="!usableMembers(role)" class="grants__note grants__note--warn">
          {{
            role.members.length
              ? "Every member's module is disabled on the modifier, so none of what this role is granted can be used until one is enabled again."
              : "Nobody holds this role, so none of what it is granted can be used until someone is added to it."
          }}
        </p>

        <OnboardingRawPermissionsQueue
          v-if="role.entries.length"
          title="May call"
          collapsible
          flag-text="has calls inert until activation"
          :summary-text="queueSummary(role)"
          :entries="role.entries"
          :notes="inertNotes(role)"
          :locked="role.entries.map((_, i) => i)"
          :context-role="role.label"
          :chain-id="chainId"
          :vault-address="fundAddress"
          :safe-address="safeAddress"
          :roles-mod-address="rolesModAddress"
          :base-token="baseToken"
        />
        <p v-else class="grants__status">
          Nothing is granted to this role.
        </p>
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
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
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
const roles = computed(() => layout.value.views);

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
const queueSummary = (role: IStoredRoleView): string => {
  const scoped = role.contracts - role.openContracts;
  const parts: string[] = [];
  if (scoped) parts.push(`${plural(role.functions, "function")} on ${plural(scoped, "contract")}`);
  if (role.openContracts) parts.push(`any function on ${plural(role.openContracts, "contract")}`);
  return parts.join(", ");
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
const inertNotes = (role: IStoredRoleView) => {
  const pending = props.pendingActivation;
  const notes: Record<number, { text: string; tone: "warn" }> = {};
  if (!pending?.modifier && !pending?.settings) return notes;
  for (const { index, description } of describeQueuedCalls(role.entries)) {
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

  &__role {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid $color-line;
  }

  &__role_head {
    display: flex;
    align-items: baseline;
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
