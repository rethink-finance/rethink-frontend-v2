<template>
  <div class="fund_info_governance">
    <UiDataBar title="Governance">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <template v-if="isZeroAddress(fundStore.userFundDelegateAddress)">
            N/A
          </template>
          <template v-else>
            <v-tooltip activator="parent" location="bottom">
              {{ fundStore.userFundDelegateAddress }}
            </v-tooltip>
            {{ truncateAddress(fundStore.userFundDelegateAddress) }}
          </template>
        </div>
        <div class="data_bar__subtitle">Delegating To</div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ userGovernanceTokenBalanceFormatted }}
          {{ fund.governanceToken.symbol }}
        </div>
        <div class="data_bar__subtitle">Voting Power</div>
      </div>
      <div class="data_bar__item">
        <v-btn
          class="button"
          variant="outlined"
          @click="isDelegateDialogOpen = true"
        >
          Delegate
        </v-btn>
      </div>
    </UiDataBar>

    <FundGovernanceModalDelegateVotes v-model="isDelegateDialogOpen" />
  </div>
</template>

<script lang="ts">
import { useFundStore } from "~/store/fund.store";
import type IFund from "~/types/fund";

export default {
  name: "FundInfoGovernance",
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
  data() {
    return {
      isDelegateDialogOpen: false,
    };
  },
  computed: {
    userGovernanceTokenBalanceFormatted() {
      return formatTokenValue(
        this.fundStore.userGovernanceTokenBalance,
        this.fund.governanceToken.decimals
      );
    },
    fundGovernanceToken() {
      return this.fundStore.fund?.governanceToken;
    },
    userFundGovernanceTokenFormatted() {
      if (!this.fundGovernanceToken) return "N/A";
      const value = Number(
        formatTokenValue(
          this.fundStore.userGovernanceTokenBalance,
          this.fundGovernanceToken.decimals,
          false
        )
      );
      return formatNumberShort(value) + " " + this.fundGovernanceToken.symbol;
    },
    // governanceManageUrl(): string {
    //   /** Example:
    //    * https://www.tally.xyz/gov/tfd3-0xface6562d7e39ea73b67404a6454fbbbefeca553
    //    * **/
    //   return `https://www.tally.xyz/gov/${this.fund.fundToken.symbol}-${this.fund.governorAddress}/my-voting-power`;
    // },
  },
};
</script>

<style lang="scss" scoped>
.fund_info_governance {
  &__manage_button {
    //height: 2rem !important;
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
    @include lg {
      padding-left: 1.25rem !important;
      padding-right: 1.25rem !important;
    }
  }
}

button {
  color: $color-secondary !important;
}
</style>
