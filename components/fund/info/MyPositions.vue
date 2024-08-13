<template>
  <div class="fund_info_my_positions">
    <UiDataBar title="My Positions">
      <!-- TODO: Currently Hide Net Deposits until we start fetching them. -->
      <!--      <div class="data_bar__item">-->
      <!--        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingUserBalances}">-->
      <!--          <v-progress-circular-->
      <!--            v-if="fundStore.loadingUserBalances"-->
      <!--            class="d-flex"-->
      <!--            size="18"-->
      <!--            width="2"-->
      <!--            indeterminate-->
      <!--          />-->
      <!--          <template v-else>-->
      <!--            {{ fund?.netDeposits || "N/A" }}-->
      <!--          </template>-->
      <!--        </div>-->
      <!--        <div class="data_bar__subtitle">-->
      <!--          Net Deposits-->
      <!--        </div>-->
      <!--      </div>-->
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingUserBalances}">
          <v-progress-circular
            v-if="fundStore.loadingUserBalances"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ userFundTokenBalanceFormatted }}
          </template>
        </div>
        <div class="data_bar__subtitle">
          OIV value
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingUserBalances}">
          <v-progress-circular
            v-if="fundStore.loadingUserBalances"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ userCurrentValueFormatted }}
          </template>
        </div>
        <div class="data_bar__subtitle">
          Current Value
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingUserBalances}">
          <v-progress-circular
            v-if="fundStore.loadingUserBalances"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ userFundAllowanceFormatted }}
          </template>
        </div>
        <div class="data_bar__subtitle">
          Allowance
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
    fundToken() {
      return this.fundStore.fund?.fundToken;
    },
    userFundTokenBalanceFormatted() {
      if (!this.fundToken) return "N/A";
      const value = Number(
        formatTokenValue(
          this.fundStore.userFundTokenBalance,
          this.fundToken.decimals,
          false,
        ),
      );
      return formatNumberShort(value) + " " + this.fundToken.symbol;
    },
    userFundAllowanceFormatted() {
      if (!this.fundBaseToken) return "N/A";
      const value = Number(
        formatTokenValue(
          this.fundStore.userFundAllowance,
          this.fundBaseToken.decimals,
          false,
        ),
      );
      return formatNumberShort(value) + " " + this.fundBaseToken.symbol;
    },
    userCurrentValueFormatted() {
      if (!this.fundBaseToken) return "N/A";
      const value = Number(
        formatTokenValue(
          this.fundStore.userCurrentValue,
          this.fundBaseToken.decimals,
          false,
        ),
      );
      return formatNumberShort(value) + " " + this.fundBaseToken.symbol;
    },
  },
  methods: { numberColorClass },
};
</script>
