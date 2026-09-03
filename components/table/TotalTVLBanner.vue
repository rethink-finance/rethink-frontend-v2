<template>
  <div class="total_tvl_stats">
    <div class="total_tvl">
      <div class="total_tvl__value">
        <!-- The last known figure is served from cache while the request is
             in flight; a spinner only when there is nothing to show yet. -->
        <v-progress-circular
          v-if="isLoadingTotalTVL && !totalTVL?.totalTvlUSDFormatted"
          class="d-flex"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else-if="totalTVL?.totalTvlUSDFormatted">
          ${{ totalTVL?.totalTvlUSDFormatted }}
        </template>
        <template v-else>
          N/A
        </template>
      </div>
      <div class="total_tvl__label">
        Total value locked
      </div>
    </div>
    <div class="total_tvl_stats__divider" />
    <div class="total_tvl">
      <div class="total_tvl__value">
        <v-progress-circular
          v-if="isLoadingVaultCount"
          class="d-flex"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          {{ vaultCount || "N/A" }}
        </template>
      </div>
      <div class="total_tvl__label">
        Vaults
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useFundsStore } from "~/store/funds/funds.store";
import { ActionState } from "~/types/enums/action_state";
import { useActionStateStore } from "~/store/actionState.store";

const actionStateStore = useActionStateStore();
const fundsStore = useFundsStore();
const { totalTVL, funds } = storeToRefs(fundsStore);

const isLoadingTotalTVL =
  computed(() => actionStateStore.isActionState("fetchTotalTVLAction", ActionState.Loading));

/**
 * Count the vaults actually listed rather than the backend's fundCount:
 * that figure includes the test and bugged vaults the discover table
 * filters out (see excludedFundAddresses.config), so it reads higher than
 * the list below it. The TVL figure is unaffected — those vaults hold
 * nothing, so the backend total already matches the rows on screen.
 */
const vaultCount = computed(() => funds.value.length);

const isLoadingVaultCount = computed(
  () =>
    !funds.value.length &&
    actionStateStore.isActionState("fetchFundsAction", ActionState.Loading),
);
</script>

<style lang="scss" scoped>
/* Brand stat block (design-file "Stat"): mono value over mono
   uppercase label, stats separated by a vertical hairline. */
.total_tvl_stats {
  display: flex;
  align-items: stretch;
  gap: 2rem;

  &__divider {
    width: 1px;
    background: $color-line;
  }
}
.total_tvl {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;

  &__value {
    font-family: $font-mono;
    font-size: 1.625rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: $color-white;
  }
  &__label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}
</style>
