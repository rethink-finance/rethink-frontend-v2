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
        <div class="data_bar__subtitle">
          Delegating To
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ userGovernanceTokenBalanceFormatted }}
          {{ fund.governanceToken.symbol }}
        </div>
        <div class="data_bar__subtitle">
          Voting Power
        </div>
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

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import { truncateAddress , isZeroAddress } from "~/composables/addressUtils";
import type IFund from "~/types/fund";
const fundStore = useFundStore();

const isDelegateDialogOpen = ref(false);

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const userGovernanceTokenBalanceFormatted = computed(() => {
  return formatTokenValue(
    fundStore.userGovernanceTokenBalance,
    props.fund?.governanceToken.decimals,
    false,
    true,
  );
});
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
