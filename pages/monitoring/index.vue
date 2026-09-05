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
          index built {{ builtAgo }}
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
        <button type="button" class="monitoring__toggle" @click="showRecent = !showRecent">
          <div>
            <span class="brand_card__eyebrow">Closed in the last 30 days</span>
            <div class="monitoring__section_caption">
              Executed, defeated or canceled — graded the same way, for the record.
            </div>
          </div>
          <span class="monitoring__toggle_meta">
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
  fetchMonitoringOverview,
  isFlaggedLevel,
  SEVERITY_RANK,
  type MonitoredProposal,
  type MonitoringOverview,
} from "~/services/backend/monitoring";

/**
 * The platform-wide governance watch. One backend read gives every vault's
 * proposals already decoded and graded; this page only filters and lays them
 * out, worst first, and keeps itself fresh on a timer.
 */
useHead({ title: "Monitoring" });

const overview = ref<MonitoringOverview | null>(null);
const isLoading = ref(false);
const error = ref("");
const now = ref(Date.now());

const chainFilter = ref("all");
const levelFilter = ref("all");
const search = ref("");
const showExecutable = ref(false);
const showRecent = ref(false);

const load = async () => {
  isLoading.value = true;
  try {
    overview.value = await fetchMonitoringOverview();
    error.value = "";
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    console.error("Monitoring overview failed", e);
  } finally {
    isLoading.value = false;
  }
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
