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
        <div class="data_bar__title" :class="{'justify-center': isLoadingUserBalances}">
          <v-progress-circular
            v-if="isLoadingUserBalances"
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
        <div class="data_bar__title" :class="{'justify-center': isLoadingUserBalances}">
          <v-progress-circular
            v-if="isLoadingUserBalances"
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
        <div class="data_bar__title" :class="{'justify-center': isLoadingUserBalances}">
          <v-progress-circular
            v-if="isLoadingUserBalances"
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
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
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
    const actionStateStore = useActionStateStore();
    return { fundStore, actionStateStore };
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
      return this.fundStore.getFormattedFundTokenValue(this.fundStore.fundUserData.fundTokenBalance);
    },
    userFundAllowanceFormatted() {
      if (!this.fundBaseToken) return "N/A";
      return this.fundStore.getFormattedBaseTokenValue(this.fundStore.fundUserData.fundAllowance);
    },
    userCurrentValueFormatted() {
      if (!this.fundBaseToken) return "N/A";
      // test on ETH chain because of decimals(18)
      // const value = "319999999648000000352";
      // return this.fundStore.getFormattedBaseTokenValue(value);

      return this.fundStore.getFormattedBaseTokenValue(this.fundStore.userCurrentValue);
    },
    isLoadingUserBalances() {
      return this.actionStateStore.isActionState("fetchUserBalancesAction", ActionState.Loading);
    },
  },
  methods: { numberColorClass },
};
</script>
