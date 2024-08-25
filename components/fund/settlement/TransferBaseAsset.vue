<template>
  <div class="transfer">
    <div class="transfer__header">
      <div class="transfer__title">
        Transfer Base Asset to the Fund Contract
      </div>
      <div class="transfer__subtitle">
        Transfer any base asset amount from the custody (safe) to fund contract.
      </div>
    </div>
    <div class="transfer__token">
      <div class="transfer__token_data">
        <div class="transfer__token_col">
          {{ baseToken?.symbol }}
        </div>
        <div class="transfer__token_col pa-0 transfer__token_col--dark text-end">
          <InputNumber
            v-model="tokenValue"
            :rules="tokenValueRules"
            class="transfer__input_amount"
          />
        </div>
      </div>
      <div class="transfer__balance">
        Balance:
        <strong
          class="set_token_value_button mx-1"
          @click="setTokenValue(safeContractBaseTokenBalanceFormatted)"
        >
          {{ safeContractBaseTokenBalanceFormatted }} {{ baseToken?.symbol }}
        </strong>
      </div>
    </div>

    <div class="buttons_container">
      <v-tooltip
        :disabled="!transferTooltipText"
        bottom
      >
        <template #default>
          {{ transferTooltipText }}
        </template>
        <template #activator="{ props }">
          <!-- Wrap it in the span to show the tooltip even if the button is disabled. -->
          <span v-bind="props">
            <v-btn
              class="bg-primary text-secondary"
              :disabled="!!transferTooltipText"
              @click="transfer"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="isTransferLoading"
                  class="d-flex"
                  size="20"
                  width="3"
                  indeterminate
                />
              </template>
              Transfer
            </v-btn>
          </span>
        </template>
      </v-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund.store";

const fundStore = useFundStore();

// const emit = defineEmits(["update:modelValue"]);

const baseToken = computed(() => {
  return fundStore.fund?.baseToken;
});
const tokenValue = ref("");
const isTransferLoading = ref(false);

const setTokenValue = (value: any) => {
  tokenValue.value = value;
}
// Merge default rules with custom provided rules.
const tokenValueRules = [
  // TODO Add rule for max decimals
  (value: string) => {
    const valueWei = ethers.parseUnits(value || "0", baseToken.value?.decimals);
    if (valueWei <= 0) return "Value must be positive."
    if (valueWei > safeContractBaseTokenBalance.value) return "Not enough balance."
    return true;
  },
];

const safeContractBaseTokenBalance = computed(() => {
  return fundStore.fund?.safeContractBaseTokenBalance || 0n;
});
const safeContractBaseTokenBalanceFormatted = computed(() => {
  if (!baseToken.value) return "--";
  return formatTokenValue(safeContractBaseTokenBalance.value, baseToken.value?.decimals, false);
});
const transferTooltipText = computed(() => {
  return "test"
});

const transfer = () => {
  return "test"
};
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.transfer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__title {
    font-size: $text-md;
    font-weight: 500;
    color: $color-title;
    margin-bottom: 0.5rem;
  }
  &__subtitle {
    font-size: $text-md;
    color: $color-light-subtitle;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.15rem;
  }
}

.set_token_value_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
