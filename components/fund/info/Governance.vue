<template>
  <div class="fund_info_governance">
    <UiDataBar title="Governance">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <Icon
            name="mdi:circle"
            color="white"
            size="0.75rem"
            class="mr-2"
          />
          {{ truncateAddress(fund.delegatingAddress) }}
        </div>
        <div class="data_bar__subtitle">
          Delegating To
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.votingPower }} {{ fund.fundToken.name }}
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

export default {
  name: "FundInfoGovernance",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
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
