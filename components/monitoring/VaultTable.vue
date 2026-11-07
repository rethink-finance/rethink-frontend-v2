<template>
  <div class="vault_table">
    <div class="vault_table__scroll">
      <div class="vault_table__grid">
        <div class="vault_table__row vault_table__row--head">
          <div class="vault_table__th">
            Vault
          </div>
          <div class="vault_table__th">
            Posture
          </div>
          <div class="vault_table__th vault_table__th--right">
            Quorum
          </div>
          <div class="vault_table__th vault_table__th--right">
            Threshold
          </div>
          <div class="vault_table__th vault_table__th--right">
            Voting period
          </div>
          <div class="vault_table__th vault_table__th--right">
            Live
          </div>
          <div class="vault_table__th vault_table__th--right">
            Activity
          </div>
          <div class="vault_table__th">
            Notes
          </div>
        </div>

        <div
          v-for="vault in vaults"
          :key="vault.chainId + vault.fundAddress"
          class="vault_table__vault_rows"
        >
          <div class="vault_table__row" :class="{ 'vault_table__row--open': isOpen(vault) }">
            <div class="vault_table__vault">
              <IconChain :chain-id="vault.chainId" :size="16" />
              <div class="vault_table__names">
                <nuxt-link :to="vaultUrl(vault)" class="vault_table__name">
                  {{ vault.fundName || truncateAddress(vault.fundAddress) }}
                </nuxt-link>
                <span class="vault_table__symbol">{{ vault.fundSymbol }} · {{ vault.baseTokenSymbol || "?" }}</span>
              </div>
            </div>

            <div>
              <MonitoringThreatBadge :level="vault.level" />
            </div>

            <div class="vault_table__number" :class="{ 'vault_table__number--bad': vault.quorumPercent < 10 }">
              {{ vault.quorumPercent.toFixed(vault.quorumPercent % 1 ? 2 : 0) }}%
            </div>

            <div class="vault_table__number" :class="{ 'vault_table__number--dim': vault.proposalThreshold === '0' }">
              {{ thresholdText(vault) }}
            </div>

            <div class="vault_table__number">
              {{ votingPeriod(vault) }}
            </div>

            <div class="vault_table__number" :class="{ 'vault_table__number--bad': vault.flaggedProposals > 0 }">
              {{ vault.liveProposals }}<span v-if="vault.flaggedProposals" class="vault_table__flagged"> · {{ vault.flaggedProposals }} flagged</span>
            </div>

            <div class="vault_table__number">
              <button
                v-if="vault.activity.length"
                type="button"
                class="vault_table__activity"
                :class="{ 'vault_table__activity--bad': vault.activityAlerts > 0 }"
                :aria-expanded="isOpen(vault)"
                :title="`${vault.activity.length} graded events in the last 30 days · ${vault.activityAlerts} at high or critical in the last 7 days`"
                @click="toggle(vault)"
              >
                {{ vault.activity.length }}<span v-if="vault.activityAlerts" class="vault_table__flagged"> · {{ vault.activityAlerts }} alert{{ vault.activityAlerts === 1 ? "" : "s" }}</span>
                <Icon
                  icon="octicon:chevron-down-16"
                  width="0.875rem"
                  height="0.875rem"
                  class="vault_table__chevron"
                  :class="{ 'vault_table__chevron--open': isOpen(vault) }"
                />
              </button>
              <span v-else class="vault_table__number--dim">0</span>
            </div>

            <div class="vault_table__notes">
              <span
                v-for="flag in vault.flags"
                :key="flag.code"
                class="vault_table__note"
                :class="`vault_table__note--${flag.severity}`"
                :title="flag.detail"
              >
                {{ flag.title }}
              </span>
              <span v-if="vault.contextError" class="vault_table__note vault_table__note--medium" :title="vault.contextError">
                settings unreadable
              </span>
              <span v-if="!vault.roleModules.length" class="vault_table__note vault_table__note--info">
                no Roles modifier
              </span>
              <span v-if="!vault.snapshotUpdatedAt" class="vault_table__note vault_table__note--info">
                not indexed yet
              </span>
            </div>
          </div>
          <div v-if="isOpen(vault)" class="vault_table__activity_row">
            <div class="vault_table__activity_caption">
              Outside governance, last 30 days · newest first
            </div>
            <MonitoringActivityList :items="activityRows(vault)" :show-vault="false" />
          </div>
        </div>
      </div>
    </div>
    <div v-if="!vaults.length" class="vault_table__empty">
      No vaults match.
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import { formatApproximateDuration, formatNumberShort } from "~/composables/formatters";
import type { ActivityRow } from "~/components/monitoring/ActivityList.vue";
import { shareDecimals, type MonitoredVault } from "~/services/backend/monitoring";

/**
 * Every vault's governance posture side by side: the numbers that decide how
 * cheaply a hostile proposal passes (quorum, threshold, voting window) and
 * the vault-level flags the rules raised without any proposal at all.
 */
defineProps<{
  vaults: MonitoredVault[];
}>();

const fromUnits = (raw: string, decimals: number): number => {
  try {
    const value = BigInt(raw || "0");
    const base = 10n ** BigInt(decimals || 0);
    return Number(value / base) + Number(value % base) / Number(base);
  } catch {
    return 0;
  }
};

/** A dust threshold (1000 wei on an 18-decimal token) is worth saying, not NaN. */
const thresholdText = (vault: MonitoredVault) => {
  if (vault.proposalThreshold === "0") return "none";
  const value = fromUnits(vault.proposalThreshold, shareDecimals(vault));
  return value > 0 && value < 0.01 ? "<0.01" : formatNumberShort(value);
};

/** Seconds read as-is; a block count is dated by a rough per-chain block time. */
const BLOCK_SECONDS: Record<string, number> = {
  "0x1": 12,
  "0xa4b1": 12, // Arbitrum governors count L1 blocks
  "0x2105": 2,
  "0x89": 2.1,
  "0x3e7": 1,
};

const votingPeriod = (vault: MonitoredVault) => {
  const period = Number(vault.votingPeriod || 0);
  if (!period) return "—";
  const seconds = vault.clockMode === "timestamp" ? period : period * (BLOCK_SECONDS[vault.chainId] ?? 12);
  return formatApproximateDuration(seconds).replace("≈ ", vault.clockMode === "timestamp" ? "" : "≈ ");
};

const vaultUrl = (vault: MonitoredVault) =>
  `/details/${vault.chainId}-${vault.fundSymbol}-${vault.fundAddress}/governance`;

/** Which vaults have their activity list unfolded beneath the row. */
const openVaults = ref(new Set<string>());
const vaultKey = (vault: MonitoredVault) => `${vault.chainId}-${vault.fundAddress.toLowerCase()}`;
const isOpen = (vault: MonitoredVault) => openVaults.value.has(vaultKey(vault));
const toggle = (vault: MonitoredVault) => {
  const next = new Set(openVaults.value);
  const key = vaultKey(vault);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openVaults.value = next;
};

const activityRows = (vault: MonitoredVault): ActivityRow[] =>
  vault.activity.map((flag) => ({
    ...flag,
    chainId: vault.chainId,
    fundAddress: vault.fundAddress,
    fundName: vault.fundName,
    fundSymbol: vault.fundSymbol,
  }));
</script>

<style lang="scss" scoped>
.vault_table {
  // A size container, so the unfolded activity list below can take the
  // visible width (100cqw) while the rows scroll sideways past it.
  &__scroll {
    overflow-x: auto;
    container-type: inline-size;
  }

  &__vault_rows {
    min-width: 1080px;
  }

  &__row {
    display: grid;
    min-width: 1080px;
    grid-template-columns: minmax(0, 1.6fr) 110px 80px 90px 110px 110px 120px minmax(0, 1.4fr);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid $color-line;

    &--head {
      height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      border-top: 1px solid $color-line;
    }

    &--open {
      border-bottom-color: transparent;
    }
  }

  &__activity {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: $color-white;
    cursor: pointer;

    &:hover {
      color: $color-cyan;
    }

    &--bad {
      color: $color-neg;
    }
  }

  &__chevron {
    color: $color-steel-blue;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  // The rows scroll sideways on a narrow screen; the unfolded list is as wide
  // as the visible table and sticks to its left edge, so it never scrolls off.
  &__activity_row {
    position: sticky;
    left: 0;
    box-sizing: border-box;
    width: 100cqw;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0 1.5rem 1rem 3rem;
    border-bottom: 1px solid $color-line;
  }

  &__activity_caption {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-text-irrelevant;
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }
  }

  &__vault {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  &__names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: $color-white;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: $color-cyan;
    }
  }

  &__symbol {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: $color-text-irrelevant;
  }

  &__number {
    font-family: $font-mono;
    font-size: 12px;
    text-align: right;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    &--bad {
      color: $color-neg;
    }

    &--dim {
      color: $color-text-irrelevant;
    }
  }

  &__flagged {
    font-size: 10.5px;
  }

  &__notes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__note {
    padding: 0.125rem 0.4375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
    white-space: nowrap;

    &--critical,
    &--high {
      color: $color-neg;
      border-color: $color-neg-line;
      background: $color-neg-soft;
    }

    &--medium {
      color: $color-warn;
      border-color: $color-warn-line;
    }

    &--info {
      color: $color-text-irrelevant;
    }
  }

  &__empty {
    padding: 1.5rem;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}
</style>
