<template>
  <div class="fund_info_my_positions">
    <UiDataBar title="My Positions">
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund?.netDeposits || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Net Deposits
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ userCurrentValueFormatted }}
        </div>
        <div class="data_bar__subtitle">
          Current Value
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          <!--        <div class="data_bar__title" :class="numberColorClass(fund.totalReturn)">-->
          <!--          {{ fund.totalReturn ? formatPercent(fund.totalReturn) : "N/A" }}-->
          {{ userFundAllowanceFormatted }}
        </div>
        <div class="data_bar__subtitle">
          <!--          Total Return-->
          Allowance
        </div>
      </div>
    </UiDataBar>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { numberColorClass } from "~/composables/numberColorClass";
import { useFundStore } from "~/store/fund.store";

export default {
  name: "FundInfoMyPositions",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  setup() {
    const fundStore = useFundStore();
    return { fundStore };
  },
  computed: {
    fundBaseToken() {
      return this.fundStore.fund?.baseToken;
    },
    userFundAllowanceFormatted() {
      if (!this.fundBaseToken) return "N/A";
      const value = Number(formatTokenValue(this.fundStore.userFundAllowance, this.fundBaseToken.decimals, false));
      return formatNumberShort(value) + " " + this.fund.baseToken.symbol;
    },
    userCurrentValueFormatted() {
      if (!this.fundBaseToken) return "N/A";
      const value = Number(formatTokenValue(this.fundStore.userFundShareValue, this.fundBaseToken.decimals, false));
      return formatNumberShort(value) + " " + this.fund.baseToken.symbol;
    },
  },
  methods: { numberColorClass },
};
</script>
