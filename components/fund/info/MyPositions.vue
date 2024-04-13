<template>
  <div class="fund_info_my_positions">
    <UiDataBar title="My Positions">
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.netDeposits || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Net Deposits
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.currentValue || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Current Value
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="numberColorClass(fund.totalReturn)">
          {{ fund.totalReturn ? formatPercent(fund.totalReturn) : "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Total Return
        </div>
      </div>
    </UiDataBar>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { numberColorClass } from "~/composables/numberColorClass";

export default {
  name: "FundInfoMyPositions",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  methods: { numberColorClass },
};
</script>
