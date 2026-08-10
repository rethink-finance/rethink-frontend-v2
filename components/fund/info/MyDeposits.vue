<template>
  <div class="my_deposits brand_card">
    <div class="brand_card__eyebrow my_deposits__title">
      My deposits
    </div>

    <div class="my_deposits__rows">
      <div v-for="row in rows" :key="row.label" class="my_deposits__row">
        <div class="my_deposits__label">
          {{ row.label }}
        </div>
        <div class="my_deposits__value">
          <v-progress-circular
            v-if="isLoadingUserBalances"
            size="16"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ row.value }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

const isLoadingUserBalances = computed(() =>
  actionStateStore.isActionState("fetchUserBalancesAction", ActionState.Loading),
);

const rows = computed(() => [
  {
    label: "Current value",
    value: fundStore.fund?.baseToken
      ? fundStore.getFormattedBaseTokenValue(fundStore.userCurrentValue)
      : "N/A",
  },
  {
    label: "LP tokens",
    value: fundStore.fund?.fundToken
      ? fundStore.getFormattedFundTokenValue(
        fundStore.fundUserData.fundTokenBalance,
      )
      : "N/A",
  },
  {
    label: "Allowance",
    value: fundStore.fund?.baseToken
      ? fundStore.getFormattedBaseTokenValue(fundStore.fundUserData.fundAllowance)
      : "N/A",
  },
]);
</script>

<style lang="scss" scoped>
/**
 * Rail card: label/value rows stacked, because the 380px column the design
 * gives this has no room for the horizontal data bar it used to be.
 */
.my_deposits {
  padding: 1.375rem 1.5rem;

  &__title {
    margin-bottom: 0.875rem;
  }

  &__rows {
    display: flex;
    flex-direction: column;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid $color-line;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }
}
</style>
