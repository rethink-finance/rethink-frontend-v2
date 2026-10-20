<template>
  <v-dialog
    :model-value="modelValue"
    max-width="980px"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="brand_modal">
      <div class="brand_modal__head">
        <div class="brand_modal__heading">
          <div class="brand_modal__eyebrow">
            Calculator
          </div>
          <h2 class="brand_modal__title">
            What your stake could earn
          </h2>
        </div>
        <button
          type="button"
          class="brand_modal__close"
          aria-label="Close"
          @click="emit('update:modelValue', false)"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>
      <div class="brand_modal__body calc_dialog__body">
        <StakingVentureCalculator :pool-eth="poolEth" @stake="onStake" />
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

defineProps<{
  modelValue: boolean;
  poolEth: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  stake: [symbol: VentureAsset["symbol"], amount: number];
}>();

/** Staking from the modal closes it and hands the amount to the deposit card. */
const onStake = (symbol: VentureAsset["symbol"], amount: number) => {
  emit("update:modelValue", false);
  emit("stake", symbol, amount);
};
</script>

<style scoped lang="scss">
// The calculator pads its own panels; the modal body only scrolls.
.calc_dialog__body {
  padding: 0 !important;
}
</style>
