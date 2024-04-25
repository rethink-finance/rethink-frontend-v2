<template>
  <div class="fund_insights">
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <Icon
            :icon="fund.chainIcon"
            class="mr-2"
          />
          {{ capitalizeFirst(fund.chainName) || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Chain
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
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.cumulativeReturnPercent)"
        >
          {{ fund.cumulativeReturnPercent ? formatPercent(fund.cumulativeReturnPercent) : "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Cumulative
        </div>
      </div>
      <div class="data_bar__item">
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.monthlyReturnPercent)"
        >
          {{ fund.monthlyReturnPercent ? formatPercent(fund.monthlyReturnPercent) : "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Monthly Return
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.sharpeRatio ||  "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Sharpe Ratio
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          <FundInfoPositionTypesBar
            :position-types="fund?.positionTypes ?? []"
          />
        </div>
        <div class="data_bar__subtitle">
          Position Types
        </div>
      </div>
    </UiDataBar>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { numberColorClass } from "~/composables/numberColorClass";

export default {
  name: "FundInfoInsights",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {};
  },
  methods: { numberColorClass },
};
</script>
