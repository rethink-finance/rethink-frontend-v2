<template>
  <div class="fund_insights">
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <Icon
            :icon="fundChainIcon.name"
            :width="fundChainIcon.size"
            :height="fundChainIcon.size"
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
          {{ fundStore.fundTotalNAVFormattedShort ?? "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          AUM
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
          {{ fund.cumulativeReturnPercent ? formatPercent(fund.cumulativeReturnPercent, true) : "N/A" }}
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
          {{ fund.monthlyReturnPercent ? formatPercent(fund.monthlyReturnPercent, true) : "N/A" }}
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

<script lang="ts">
import { numberColorClass } from "~/composables/numberColorClass";
import { useFundStore } from "~/store/fund.store";
import type IFund from "~/types/fund";

export default {
  name: "FundInfoInsights",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  setup() {
    const fundStore = useFundStore();
    return { fundStore }
  },
  data() {
    return {};
  },
  computed: {
    fundChainIcon() {
      return getChainIcon(this.fund?.chainShort)
    },
  },
  methods: { numberColorClass },
};
</script>
