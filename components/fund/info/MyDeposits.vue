<template>
  <div class="my_deposits">
    <UiDataBar title="My Deposits">
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
          LP Tokens
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
  name: "FundInfoMyDeposits",
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
      return this.fundStore.formatFundTokenValue(this.fundStore.userFundTokenBalance, false, true);
    },
    userFundAllowanceFormatted() {
      if (!this.fundBaseToken) return "N/A";
      return this.fundStore.formatBaseTokenValue(this.fundStore.userFundAllowance, false, true);
    },
    userCurrentValueFormatted() {
      if (!this.fundBaseToken) return "N/A";
      return this.fundStore.formatBaseTokenValue(this.fundStore.userCurrentValue, false, true);
    },
  },
  methods: { numberColorClass },
};
</script>
