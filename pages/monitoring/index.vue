<template>
  <div class="monitoring page_shell">
    <div class="monitoring__head">
      <div>
        <h1 class="monitoring__title">
          Monitoring
        </h1>
        <p class="monitoring__subtitle">
          Every live governance proposal across Rethink vaults, decoded and checked for
          suspicious executable code.
        </p>
      </div>
      <div class="monitoring__status">
        <span v-if="overview" class="monitoring__status_line">
          overview built {{ builtAgo }}
          <template v-if="health">
            · index
            <span
              v-for="chain in indexedChains"
              :key="chain.chainId"
              class="monitoring__lag"
              :class="`monitoring__lag--${chain.status}`"
              :title="`${chainName(chain.chainId)}: ${chain.detail}`"
            >{{ chainName(chain.chainId) }} {{ formatLag(chain.lagSeconds ?? chain.scanAgeSeconds) }}</span>
          </template>
          <span v-if="staleChains.length" class="monitoring__status_warn" :title="staleChains.map((c) => `${chainName(c.chainId)}: ${c.error}`).join('\n')">
            · {{ staleChains.length }} chain{{ staleChains.length === 1 ? "" : "s" }} unreadable
          </span>
        </span>
        <button
          type="button"
          class="monitoring__refresh"
          :disabled="isLoading"
          @click="load"
        >
          <Icon
            icon="octicon:sync-16"
            width="0.875rem"
            height="0.875rem"
            :class="{ 'monitoring__spin': isLoading }"
          />
          Refresh
        </button>
      </div>
    </div>

    <div v-if="error && !overview" class="brand_card monitoring__error">
      <div class="monitoring__error_title">
        The monitoring index is unreachable.
      </div>
      <div class="monitoring__error_detail">
        {{ error }}
      </div>
    </div>

    <template v-else>
      <div
        v-if="health && health.status !== 'ok'"
        class="brand_card monitoring__health"
        :class="`monitoring__health--${health.status}`"
        role="alert"
      >
        <div class="monitoring__health_head">
          <span class="monitoring__health_badge">{{ health.status }}</span>
          <div class="monitoring__health_title">
            <template v-if="health.status === 'down'">
              The monitor is not watching right now. Nothing below can be trusted to be current.
            </template>
            <template v-else>
              The monitor is degraded. Part of what this page shows may be stale.
            </template>
          </div>
        </div>
        <ul class="monitoring__health_list">
          <li v-for="check in failingChecks" :key="check.name">
            <span class="monitoring__health_check">{{ check.name }}</span>
            {{ check.detail }}
          </li>
        </ul>
      </div>
      <div v-else-if="healthError" class="monitoring__health_note">
        The monitor's self-check could not be read ({{ healthError }}). Treat the page as unverified.
      </div>

      <div class="monitoring__tiles">
        <div class="brand_card monitoring__tile">
          <div class="monitoring__tile_label">
            Live proposals
          </div>
          <div class="monitoring__tile_value">
            {{ overview ? overview.summary.liveProposals : "—" }}
          </div>
          <div class="monitoring__tile_hint">
            pending, active or queued
          </div>
        </div>
        <div class="brand_card monitoring__tile" :class="{ 'monitoring__tile--alert': (overview?.summary.flaggedLive ?? 0) > 0 }">
          <div class="monitoring__tile_label">
            Flagged live
          </div>
          <div class="monitoring__tile_value">
            {{ overview ? overview.summary.flaggedLive : "—" }}
          </div>
          <div class="monitoring__tile_hint">
            {{ overview?.summary.criticalLive ?? 0 }} critical
          </div>
        </div>
        <div class="brand_card monitoring__tile" :class="{ 'monitoring__tile--warn': (overview?.summary.flaggedExecutable ?? 0) > 0 }">
          <div class="monitoring__tile_label">
            Passed, never executed
          </div>
          <div class="monitoring__tile_value">
            {{ overview ? overview.summary.executableProposals : "—" }}
          </div>
          <div class="monitoring__tile_hint">
            {{ overview?.summary.flaggedExecutable ?? 0 }} flagged · still executable by anyone
          </div>
        </div>
        <div class="brand_card monitoring__tile">
          <div class="monitoring__tile_label">
            Vaults monitored
          </div>
          <div class="monitoring__tile_value">
            {{ overview ? overview.summary.vaults : "—" }}
          </div>
          <div class="monitoring__tile_hint">
            {{ overview?.summary.vaultsAtRisk ?? 0 }} with weak governance · {{ overview?.chains.length ?? 0 }} chains
          </div>
        </div>
      </div>

      <div class="monitoring__filters">
        <UiSegmented v-model="chainFilter" :options="chainOptions" />
        <UiSegmented v-model="levelFilter" :options="levelOptions" />
        <input
          v-model="search"
          type="search"
          class="monitoring__search"
          placeholder="Search vault or proposal"
        >
      </div>

      <section class="brand_card monitoring__section">
        <div class="brand_card__head">
          <div>
            <span class="brand_card__eyebrow">Live proposals</span>
            <div class="monitoring__section_caption">
              Sorted by threat grade, then by closing time.
            </div>
          </div>
          <span class="brand_card__meta">{{ filteredLive.length }} of {{ overview?.live.length ?? 0 }}</span>
        </div>
        <div v-if="isLoading && !overview" class="monitoring__loading">
          <v-progress-circular size="18" width="2" indeterminate />
          Building the overview…
        </div>
        <div v-else-if="!filteredLive.length" class="monitoring__empty">
          <template v-if="overview?.live.length">
            Nothing matches the current filters.
          </template>
          <template v-else>
            No proposal is open for voting or awaiting execution on any monitored vault right now.
          </template>
        </div>
        <div v-else class="monitoring__list">
          <MonitoringProposalCard
            v-for="proposal in filteredLive"
            :key="proposalKey(proposal)"
            :proposal="proposal"
            :vault="vaultOf(proposal)"
            :default-open="isFlaggedLevel(proposal.level)"
          />
        </div>
      </section>

      <section class="brand_card monitoring__section">
        <button type="button" class="monitoring__toggle" @click="showExecutable = !showExecutable">
          <div>
            <span class="brand_card__eyebrow">Passed but never executed</span>
            <div class="monitoring__section_caption">
              Succeeded more than two weeks ago with no timelock: anyone can still call execute on these, today.
            </div>
          </div>
          <span class="monitoring__toggle_meta">
            <span v-if="flaggedExecutableCount" class="monitoring__toggle_flag">
              {{ flaggedExecutableCount }} flagged
            </span>
            {{ filteredExecutable.length }}
            <Icon
              icon="octicon:chevron-down-16"
              width="1rem"
              height="1rem"
              :class="{ 'monitoring__chevron--open': showExecutable }"
            />
          </span>
        </button>
        <div v-if="showExecutable" class="monitoring__list monitoring__list--spaced">
          <div v-if="!filteredExecutable.length" class="monitoring__empty">
            Nothing here.
          </div>
          <MonitoringProposalCard
            v-for="proposal in filteredExecutable"
            :key="proposalKey(proposal)"
            :proposal="proposal"
            :vault="vaultOf(proposal)"
          />
        </div>
      </section>

      <section class="brand_card monitoring__section">
        <button type="button" class="monitoring__toggle" @click="toggleRecent">
          <div>
            <span class="brand_card__eyebrow">Closed in the last 30 days</span>
            <div class="monitoring__section_caption">
              Executed, defeated or canceled — graded the same way, for the record.
            </div>
          </div>
          <span class="monitoring__toggle_meta">
            <span v-if="flaggedRecentCount" class="monitoring__toggle_flag">
              {{ flaggedRecentCount }} flagged
            </span>
            {{ filteredRecent.length }}
            <Icon
              icon="octicon:chevron-down-16"
              width="1rem"
              height="1rem"
              :class="{ 'monitoring__chevron--open': showRecent }"
            />
          </span>
        </button>
        <div v-if="showRecent" class="monitoring__list monitoring__list--spaced">
          <div v-if="!filteredRecent.length" class="monitoring__empty">
            Nothing here.
          </div>
          <MonitoringProposalCard
            v-for="proposal in filteredRecent"
            :key="proposalKey(proposal)"
            :proposal="proposal"
            :vault="vaultOf(proposal)"
            :default-open="isFlaggedLevel(proposal.level)"
          />
        </div>
      </section>

      <section class="brand_card monitoring__section monitoring__section--flush">
        <div class="brand_card__head monitoring__section_head">
          <div>
            <span class="brand_card__eyebrow">Vault posture</span>
            <div class="monitoring__section_caption">
              How cheaply a hostile proposal passes on each vault. Quorum under 10% means a dust deposit can carry a vote.
            </div>
          </div>
          <span class="brand_card__meta">{{ filteredVaults.length }} vaults</span>
        </div>
        <MonitoringVaultTable :vaults="filteredVaults" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { networksMap } from "~/store/web3/networksMap";
import type { SegmentedOption } from "~/components/global/ui/Segmented.vue";
import {
  fetchMonitoringHealth,
  fetchMonitoringOverview,
  formatLag,
  isFlaggedLevel,
  SEVERITY_RANK,
  type MonitoredProposal,
  type MonitoringHealth,
  type MonitoringOverview,
} from "~/services/backend/monitoring";

/**
 * The platform-wide governance watch. One backend read gives every vault's
 * proposals already decoded and graded; this page only filters and lays them
 * out, worst first, and keeps itself fresh on a timer.
 */
useHead({ title: "Monitoring" });

const overview = ref<MonitoringOverview | null>(null);
const health = ref<MonitoringHealth | null>(null);
const healthError = ref("");
const isLoading = ref(false);
const error = ref("");
const now = ref(Date.now());

const chainFilter = ref("all");
const levelFilter = ref("all");
const search = ref("");
const showExecutable = ref(false);
const showRecent = ref(false);
// Once the reader has toggled the closed section, the auto-expand below
// must not fight them.
let recentToggledByReader = false;
const toggleRecent = () => {
  recentToggledByReader = true;
  showRecent.value = !showRecent.value;
};

/**
 * The overview and the monitor's self-check load together. The self-check
 * is what tells a reader whether "index built just now" means anything: a
 * fresh overview built from a stale index looks exactly like a healthy one.
 */
const load = async () => {
  isLoading.value = true;
  const [overviewResult, healthResult] = await Promise.allSettled([
    fetchMonitoringOverview(),
    fetchMonitoringHealth(),
  ]);
  if (overviewResult.status === "fulfilled") {
    overview.value = overviewResult.value;
    error.value = "";
  } else {
    error.value = overviewResult.reason?.message ?? String(overviewResult.reason);
    console.error("Monitoring overview failed", overviewResult.reason);
  }
  if (healthResult.status === "fulfilled") {
    health.value = healthResult.value;
    healthError.value = healthResult.value ? "" : "self-check endpoint not available on this backend";
  } else {
    health.value = null;
    healthError.value = healthResult.reason?.message ?? String(healthResult.reason);
    console.error("Monitoring health failed", healthResult.reason);
  }
  isLoading.value = false;
};

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  load();
  refreshTimer = setInterval(load, 60_000);
  clockTimer = setInterval(() => (now.value = Date.now()), 15_000);
});
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (clockTimer) clearInterval(clockTimer);
});

const chainName = (chainId: string) => networksMap[chainId]?.chainName ?? chainId;

const builtAgo = computed(() => {
  if (!overview.value) return "";
  const seconds = Math.max(0, Math.round((now.value - new Date(overview.value.generatedAt).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${(seconds / 3600).toFixed(1)} h ago`;
});

const staleChains = computed(() => overview.value?.chains.filter((c) => c.error) ?? []);
const indexedChains = computed(() => health.value?.chains.filter((c) => c.vaults > 0) ?? []);
const failingChecks = computed(() => health.value?.checks.filter((c) => c.status !== "ok") ?? []);

const chainOptions = computed<SegmentedOption[]>(() => [
  { key: "all", label: "All chains" },
  ...(overview.value?.chains ?? [])
    .filter((c) => c.vaults > 0)
    .map((c) => ({ key: c.chainId, label: chainName(c.chainId) })),
]);

const levelOptions: SegmentedOption[] = [
  { key: "all", label: "All grades" },
  { key: "review", label: "Review and up" },
  { key: "flagged", label: "Flagged" },
  { key: "critical", label: "Critical" },
];

const matchesLevel = (level: MonitoredProposal["level"]) => {
  switch (levelFilter.value) {
    case "critical":
      return level === "critical";
    case "flagged":
      return isFlaggedLevel(level);
    case "review":
      return SEVERITY_RANK[level] >= SEVERITY_RANK.medium;
    default:
      return true;
  }
};

const matchesSearch = (haystack: string) =>
  !search.value.trim() || haystack.toLowerCase().includes(search.value.trim().toLowerCase());

const filterProposals = (list: MonitoredProposal[] = []) =>
  list.filter(
    (p) =>
      (chainFilter.value === "all" || p.chainId === chainFilter.value) &&
      matchesLevel(p.level) &&
      matchesSearch(`${p.fundName} ${p.fundSymbol} ${p.title} ${p.proposer} ${p.fundAddress}`),
  );

const filteredLive = computed(() => filterProposals(overview.value?.live));
const filteredExecutable = computed(() => filterProposals(overview.value?.executable));
const filteredRecent = computed(() => filterProposals(overview.value?.recent));
const flaggedExecutableCount = computed(
  () => filteredExecutable.value.filter((p) => isFlaggedLevel(p.level)).length,
);
const flaggedRecentCount = computed(
  () => filteredRecent.value.filter((p) => isFlaggedLevel(p.level)).length,
);

/**
 * A canary governor votes in ~20 s, so its proposals are created, passed and
 * executed between two monitor ticks and never appear under "Live" — yet the
 * alert for them fires all the same. Open the closed section when the overview
 * arrives holding a flagged entry, so a reader coming from that alert finds it
 * without knowing to expand anything.
 */
watch(overview, (loaded) => {
  if (recentToggledByReader || showRecent.value) return;
  if ((loaded?.recent ?? []).some((p) => isFlaggedLevel(p.level))) {
    showRecent.value = true;
  }
});

const filteredVaults = computed(() =>
  (overview.value?.vaults ?? []).filter(
    (v) =>
      (chainFilter.value === "all" || v.chainId === chainFilter.value) &&
      matchesSearch(`${v.fundName} ${v.fundSymbol} ${v.fundAddress} ${v.safe}`),
  ),
);

const vaultOf = (proposal: MonitoredProposal) =>
  overview.value?.vaults.find(
    (v) => v.chainId === proposal.chainId && v.fundAddress.toLowerCase() === proposal.fundAddress.toLowerCase(),
  );

const proposalKey = (proposal: MonitoredProposal) =>
  `${proposal.chainId}-${proposal.fundAddress}-${proposal.proposalId}`;
</script>

<style scoped lang="scss">
.monitoring {
  display: flex;
  flex-direction: column;
  gap: 1.625rem;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-top: calc(1rem + 4px);
  }

  &__title {
    margin: 0;
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: $color-white;
  }

  &__subtitle {
    max-width: 44rem;
    margin: 0.875rem 0 0;
    font-size: $text-sm;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__status_line {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: $color-text-irrelevant;
  }

  &__status_warn {
    color: $color-warn;
  }

  &__lag {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.125rem 0.4375rem;
    border: 1px solid var(--line-2);
    border-radius: 999px;
    color: var(--text-faint-2);
    font-variant-numeric: tabular-nums;

    &--degraded {
      border-color: var(--warn-line);
      background: var(--warn-soft);
      color: var(--warn);
    }

    &--down {
      border-color: var(--neg-line);
      background: var(--neg-soft);
      color: var(--neg);
    }
  }

  &__health {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--warn-line);
    background: var(--warn-soft);

    &--down {
      border-color: var(--neg-line);
      background: var(--neg-soft);
    }
  }

  &__health_head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__health_badge {
    padding: 0.1875rem 0.5rem;
    border-radius: 999px;
    background: var(--warn);
    color: var(--bg);
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;

    .monitoring__health--down & {
      background: var(--neg);
    }
  }

  &__health_title {
    font-weight: 600;
    color: $color-white;
  }

  &__health_list {
    margin: 0;
    padding-left: 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__health_check {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-white;
  }

  &__health_note {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-warn;
  }

  &__refresh {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: $color-white;
      border-color: $color-line-3;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
  }

  &__spin {
    animation: monitoring-spin 1s linear infinite;
  }

  &__tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;

    @media (max-width: 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__tile {
    padding: 1.25rem 1.5rem;

    &--alert {
      border-color: $color-neg-line;
      background: $color-neg-soft;
    }

    &--warn {
      border-color: $color-warn-line;
    }
  }

  &__tile_label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__tile_value {
    margin-top: 0.5rem;
    font-size: 34px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__tile_hint {
    margin-top: 0.5rem;
    font-size: 12px;
    color: $color-text-irrelevant;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  &__search {
    flex: 1 1 14rem;
    max-width: 22rem;
    min-height: 2.25rem;
    height: 2.25rem;
    padding: 0 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-size: 13px;
    color: $color-white;

    &::placeholder {
      color: $color-text-irrelevant;
    }

    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__section {
    display: flex;
    flex-direction: column;

    &--flush {
      padding-left: 0;
      padding-right: 0;
      padding-bottom: 0;
    }
  }

  &__section_head {
    padding: 0 1.875rem;
  }

  &__section_caption {
    margin-top: 0.25rem;
    font-size: 12.5px;
    color: $color-steel-blue;
  }

  &__toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  &__toggle_meta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;

    svg {
      transition: transform 0.2s ease;
    }
  }

  &__toggle_flag {
    padding: 0.1rem 0.45rem;
    border: 1px solid $color-neg-line;
    border-radius: $default-border-radius;
    color: $color-neg;
    white-space: nowrap;
  }

  &__chevron--open {
    transform: rotate(180deg);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &--spaced {
      margin-top: 1.125rem;
    }
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 0;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__empty {
    padding: 1.5rem 0;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__error {
    padding: 2rem;
  }

  &__error_title {
    font-size: 15px;
    font-weight: 600;
    color: $color-white;
  }

  &__error_detail {
    margin-top: 0.5rem;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }
}

@keyframes monitoring-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
