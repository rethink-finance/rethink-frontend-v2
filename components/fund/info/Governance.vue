<template>
  <div class="fund_info_governance">
    <UiDataBar title="Governance">
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ truncateAddress(fund.governorAddress) }}
        </div>
        <div class="data_bar__subtitle">
          Delegating To
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ userGovernanceTokenBalanceFormatted }} {{ fund.governanceToken.symbol }}
        </div>
        <div class="data_bar__subtitle">
          Voting Power
        </div>
      </div>
      <div class="data_bar__item">
        <UiLinkExternalButton
          class="fund_info_governance__manage_button"
          title="Manage"
          to="#"
        />
      </div>
    </UiDataBar>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";

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
    return { fundStore }
  },
  computed: {
    userGovernanceTokenBalanceFormatted() {
      return formatTokenValue(this.fundStore.userGovernanceTokenBalance, this.fund.governanceToken.decimals);
    },
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
</style>
