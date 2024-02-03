<template>
  <div class="fund_insights">
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <Icon
            v-if="fund?.chain"
            :name="chainIconName"
            size="0.75rem"
            class="mr-2"
            color="white"
          />
          {{ capitalizeFirst(fund.chain) }}
        </div>
        <div class="data_bar__subtitle">
          Chain
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.inception_date }}
        </div>
        <div class="data_bar__subtitle">
          Inception Date
        </div>
      </div>
      <div class="data_bar__item">
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.cumulative_return_percent)"
        >
          {{ formatPercent(fund.cumulative_return_percent) }}
        </div>
        <div class="data_bar__subtitle">
          Cumulative
        </div>
      </div>
      <div class="data_bar__item">
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.monthly_return_percent)"
        >
          {{ formatPercent(fund.monthly_return_percent) }}
        </div>
        <div class="data_bar__subtitle">
          Monthly Return
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.sharpe_ratio }}
        </div>
        <div class="data_bar__subtitle">
          Sharpe Ratio
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          <FundInfoPositionTypesBar
            :position-types="fund.position_types"
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
  computed: {
    chainIconName() {
      return `cryptocurrency-color:${chainToIconName(this.fund?.chain)}`;
    },
  },
  methods: { numberColorClass },
};
</script>
