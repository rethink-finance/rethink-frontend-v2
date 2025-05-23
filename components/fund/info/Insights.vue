<template>
  <div class="fund_insights">
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <IconChain
            :chain-short="props.fund?.chainShort"
            class="mr-2"
          />
          {{ capitalizeFirst(fund.chainName) || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Chain
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': isLoadingFetchFundNAVUpdatesActionState}">
          <v-progress-circular
            v-if="isLoadingFetchFundNAVUpdatesActionState"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ fundStore.fundTotalNAVFormattedShort ?? "N/A" }}
          </template>
        </div>
        <div class="data_bar__subtitle">
          NAV
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.inceptionDate }}
        </div>
        <div class="data_bar__subtitle">
          Inception Date
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': isLoadingCalculateFundPerformanceMetricsActionState}">
          <v-progress-circular
            v-if="isLoadingCalculateFundPerformanceMetricsActionState"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            <div
              class="data_bar__title"
              :class="numberColorClass(fund?.cumulativeReturnPercent || 0)"
            >
              {{ formatPercent(fund.cumulativeReturnPercent, true) ?? "N/A" }}
            </div>
          </template>
        </div>
        <div class="data_bar__subtitle">
          Cumulative
        </div>
      </div>
      <!-- Remove Monthly Return for now -->
      <!-- <div class="data_bar__item">
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.monthlyReturnPercent)"
        >
          {{ fund.monthlyReturnPercent ? formatPercent(fund.monthlyReturnPercent, true) : "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Monthly Return
        </div>
      </div> -->

      <!-- TODO: show sharpe ratio later -->
      <!-- <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.sharpeRatio ||  "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Sharpe Ratio
        </div>
      </div> -->
      <div class="data_bar__item">
        <div class="data_bar__title">
          <FundInfoPositionTypesBar
            :position-type-counts="fund?.positionTypeCounts ?? []"
          />
        </div>
        <div class="data_bar__subtitle">
          Position Types
        </div>
      </div>
    </UiDataBar>
  </div>
</template>

<script setup lang="ts">
import { formatPercent } from "~/composables/formatters";
import { numberColorClass } from "~/composables/numberColorClass";
import { capitalizeFirst } from "~/composables/utils";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

const isLoadingFetchFundNAVUpdatesActionState =
  computed(() => actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading));

const isLoadingCalculateFundPerformanceMetricsActionState =
  computed(() => actionStateStore.isActionState("calculateFundPerformanceMetricsAction", ActionState.Loading));


const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});
</script>
