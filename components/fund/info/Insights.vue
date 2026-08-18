<template>
  <div class="fund_insights">
    <div class="fund_stats">
      <div class="fund_stats__item fund_stats__item--primary">
        <div class="fund_stats__label fund_stats__label--accent">
          Current NAV
        </div>
        <div class="fund_stats__value_row">
          <v-progress-circular
            v-if="isLoadingFetchFundLatestSnapshotActionState"
            class="d-flex"
            size="24"
            width="2"
            indeterminate
          />
          <template v-else-if="fund.totalSimulatedNav != null">
            <v-tooltip
              :disabled="
                !appSettingsStore.isManageMode ||
                  !fund.totalSimulatedNavCalculatedAt
              "
              location="bottom"
              content-class="brand_tooltip"
            >
              <template #activator="{ props: tooltipProps }">
                <div class="fund_stats__value_row" v-bind="tooltipProps">
                  <span class="fund_stats__value fund_stats__value--hero">
                    {{ navFormatted }}
                  </span>
                  <span class="fund_stats__unit">{{ fund.baseToken.symbol }}</span>
                  <span v-if="fund.totalSimulatedNavUSD" class="fund_stats__note">
                    ≈ ${{ formatNumberShort(fund.totalSimulatedNavUSD) }}
                  </span>
                </div>
              </template>
              <div class="brand_tooltip__label">
                Calculated on
              </div>
              <div class="brand_tooltip__value">
                {{ fund.totalSimulatedNavCalculatedAt }}
              </div>
            </v-tooltip>
          </template>
          <template v-else>
            <v-progress-circular
              v-if="isLoadingFetchFundNAVUpdatesActionState"
              class="d-flex"
              size="24"
              width="2"
              indeterminate
            />
            <span v-else class="fund_stats__value fund_stats__value--hero">
              {{ fundStore.fundTotalNAVFormattedShort ?? "N/A" }}
            </span>
          </template>
        </div>
      </div>

      <div class="fund_stats__divider fund_stats__divider--push" />

      <!-- Vaults that pay their yield out elsewhere report 0% return and 0% APR
           forever, which is true of the share price and useless to the reader.
           Where we know what the underlying position earns, the same two
           metrics are filled in from that instead: the APR is the yield net of
           the operator's cut, and the cumulative return is that yield carried
           over the time the vault has been open. -->
      <template v-if="stakingRewards">
        <div class="fund_stats__item">
          <div class="fund_stats__label">
            Cumulative return
          </div>
          <div class="fund_stats__value_row">
            <span class="fund_stats__value" :class="toneClass(stakingPerformance?.cumulativeReturn)">
              {{ formatPercent(stakingPerformance?.cumulativeReturn, true) ?? "N/A" }}
            </span>
          </div>
        </div>

        <div class="fund_stats__divider" />

        <div class="fund_stats__item">
          <div class="fund_stats__label">
            APR
          </div>
          <div class="fund_stats__value_row">
            <span class="fund_stats__value fund_stats__value--pos">
              {{ formatPercent(stakingPerformance?.apr, true) }}
            </span>
            <!-- Same note as every other vault. The operator's cut is already
                 taken off this figure by resolveStakingPerformance; the strip
                 below says where the yield goes without itemising it. -->
            <span class="fund_stats__note fund_stats__note--caps">Annualized</span>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="fund_stats__item">
          <div class="fund_stats__label">
            Cumulative return
          </div>
          <div class="fund_stats__value_row">
            <v-progress-circular
              v-if="isLoadingCalculateFundPerformanceMetricsActionState"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <span v-else class="fund_stats__value" :class="toneClass(fund?.cumulativeReturnPercent)">
              {{ formatPercent(fund.cumulativeReturnPercent, true) ?? "N/A" }}
            </span>
          </div>
        </div>

        <div class="fund_stats__divider" />

        <div class="fund_stats__item">
          <div class="fund_stats__label">
            APR
          </div>
          <div class="fund_stats__value_row">
            <v-progress-circular
              v-if="isLoadingCalculateFundPerformanceMetricsActionState"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <template v-else>
              <span class="fund_stats__value" :class="toneClass(roundedApr)">
                {{ apr === undefined ? "--" : formatPercent(roundedApr, true) }}
              </span>
              <span class="fund_stats__note fund_stats__note--caps">Annualized</span>
            </template>
          </div>
        </div>
      </template>
    </div>

    <div v-if="stakingRewards" class="fund_rewards">
      <div class="fund_rewards__body">
        <div class="fund_rewards__label">
          Rewards paid in {{ stakingRewards.rewardTokenSymbol }}
        </div>
        <p class="fund_rewards__text">
          {{ stakingRewards.rewardNote }}
        </p>
      </div>

      <NuxtLink
        v-if="stakingRewards.rewardVaultUrl"
        :to="stakingRewards.rewardVaultUrl"
        class="fund_rewards__button"
      >
        {{ stakingRewards.rewardActionLabel }}
      </NuxtLink>
      <!-- The rewards vault is not deployed yet. A disabled control says that
           plainly; a link to nowhere would not. -->
      <button
        v-else
        type="button"
        class="fund_rewards__button fund_rewards__button--placeholder"
        disabled
      >
        {{ stakingRewards.rewardActionLabel }}
        <span class="fund_rewards__soon">Coming soon</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatNumberShort,
  formatPercent,
  formatTokenValue,
} from "~/composables/formatters";
import { calculateAPR } from "~/composables/utils";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";
import { useSettingsStore } from "~/store/settings/settings.store";
import {
  resolveStakingPerformance,
  resolveStakingRewards,
} from "~/store/funds/config/stakingRewards.config";

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const isLoadingFetchFundNAVUpdatesActionState = computed(() =>
  actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading),
);

const isLoadingCalculateFundPerformanceMetricsActionState = computed(() =>
  actionStateStore.isActionState(
    "calculateFundPerformanceMetricsAction",
    ActionState.Loading,
  ),
);

const isLoadingFetchFundLatestSnapshotActionState = computed(() =>
  actionStateStore.isActionState(
    `fetchFundLatestSnapshot_${props.fund?.chainId}_${props.fund?.address}`,
    ActionState.Loading,
  ),
);

const navFormatted = computed(() =>
  formatNumberShort(
    formatTokenValue(
      props.fund.totalSimulatedNav || props.fund.lastNAVUpdateTotalNAV,
      props.fund.baseToken.decimals,
      false,
      false,
    ),
  ),
);

/**
 * Sign colouring for the derived metrics. Deliberately not the app-wide
 * numberColorClass: that resolves to Vuetify's success green, and the brand
 * palette signals gains in cyan.
 */
const toneClass = (value?: number) => {
  if (!value) return "";
  return value > 0 ? "fund_stats__value--pos" : "fund_stats__value--neg";
};

const apr = computed(() =>
  calculateAPR(
    props.fund?.cumulativeReturnPercent,
    props.fund?.inceptionDateTimestamp,
  ),
);

const roundedApr = computed(() =>
  apr.value === undefined ? undefined : parseFloat(apr.value.toFixed(2)),
);

/**
 * Set only for the handful of vaults whose yield leaves the vault instead of
 * accruing to the share price. Undefined everywhere else, which is what keeps
 * the standard return/APR pair as the default.
 */
const stakingRewards = computed(() =>
  resolveStakingRewards(props.fund?.chainId, props.fund?.address),
);

/** The same numbers the Discover table shows for this vault. */
const stakingPerformance = computed(() =>
  resolveStakingPerformance(
    props.fund?.chainId,
    props.fund?.address,
    props.fund?.inceptionDateTimestamp,
  ),
);
</script>

<style lang="scss" scoped>
.fund_insights {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

/**
 * Where the yield actually lands, for vaults that pay it out somewhere else.
 * It sits directly beneath the yield figure it explains, because the number on
 * its own would read as "this vault grew by 2.88%" — which it did not.
 */
.fund_rewards {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 0.9375rem 1.125rem;
  /* Green, matching the chart's yield line — this strip and that line are the
     same story told twice. */
  border: 1px solid $color-yield-line;
  border-radius: $default-border-radius;
  background: $color-yield-soft;

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
    flex: 1 1 320px;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-yield;
  }

  &__text {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: $color-light-subtitle;
  }

  &__button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.875rem;
    border: 1px solid $color-yield-line;
    border-radius: $default-border-radius;
    font-size: 12.5px;
    font-weight: 600;
    color: $color-white;
    white-space: nowrap;
    transition: border-color $default-transition-time ease;

    &:hover {
      border-color: $color-yield;
    }

    /* Nothing to open yet — read-only, and it should look it. */
    &--placeholder {
      color: $color-text-irrelevant;
      cursor: not-allowed;

      &:hover {
        border-color: $color-yield-line;
      }
    }
  }

  &__soon {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.1875rem 0.375rem;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
    color: $color-steel-blue;
  }
}

/**
 * Headline figures for the vault, laid out as the design's stat strip:
 * NAV carried at display size, the derived metrics beside it at a step down,
 * hairline dividers between. No card — it sits directly on the page.
 */
.fund_stats {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 0.8125rem;
    min-width: 0;
  }

  /* Same size as the brand_card eyebrow — these are the page's top-level
     labels and should not read smaller than the card titles below them. */
  &__label {
    font-family: $font-mono;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--accent {
      letter-spacing: 0.16em;
      color: $color-cyan;
    }
  }

  &__value_row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  &__value {
    font-family: $font-mono;
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.015em;
    line-height: 1;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    &--hero {
      font-size: clamp(30px, 3.4vw, 42px);
      letter-spacing: -0.025em;
      line-height: 0.95;
    }

    &--pos {
      color: $color-pos;
    }

    &--neg {
      color: $color-neg;
    }
  }

  &__unit {
    font-family: $font-mono;
    font-size: 17px;
    color: $color-text-irrelevant;
  }

  &__note {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-steel-blue;
    white-space: nowrap;

    &--caps {
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }

  /* Dividers only earn their keep once the row is actually side by side. */
  &__divider {
    display: none;
    width: 1px;
    align-self: stretch;
    background: $color-line;

    @include md {
      display: block;
    }

    /* Pushes the derived metrics away from NAV so the hero figure keeps the
       left edge to itself, exactly as the design lays it out. */
    &--push {
      @include md {
        margin-left: auto;
      }
    }
  }
}
</style>
