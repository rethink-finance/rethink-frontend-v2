<template>
  <div class="fund_info_governance">
    <UiDataBar title="Governance">
      <div class="data_bar__item">
        <div class="data_bar__item__title">
          <Icon
            name="mdi:circle"
            color="white"
            size="0.75rem"
            class="mr-2"
          />
          {{ truncateAddress(fund.delegating_address) }}
        </div>
        <div class="data_bar__item__subtitle">
          Delegating To
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__item__title">
          {{ fund.voting_power }} {{ fund.fund_token.name }}
        </div>
        <div class="data_bar__item__subtitle">
          Voting Power
        </div>
      </div>
      <div class="data_bar__item">
        <UiCopyButton
          class="fund_info_governance__copy_button"
          title="Manage"
          :tooltip-text="`Copy Delegating address to clipboard (${ truncateAddress(fund.delegating_address) })`"
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
  &__copy_button {
    height: 2rem !important;
  }
}
</style>
