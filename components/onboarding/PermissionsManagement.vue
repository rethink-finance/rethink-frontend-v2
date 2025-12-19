<template>
  <div class="management">
    <div class="management__row">
      <div>
        Prepopulate permissions to allow manager to send funds to the
        admin contract to settle flows
      </div>
      <v-switch
        :model-value="allowManagerToSendFundsToFundContract"
        color="primary"
        hide-details
        @update:model-value="(v) => emit('update:allowManagerToSendFundsToFundContract', v as boolean)"
      />
    </div>
    <div class="management__row">
      <div>
        Prepopulate permissions to allow manager to collect fees based on
        default performance fee contract
      </div>
      <v-switch
        :model-value="allowManagerToCollectFees"
        color="primary"
        hide-details
        @update:model-value="(v) => emit('update:allowManagerToCollectFees', v as boolean)"
      />
    </div>
    <div v-if="fundFactoryContractV2Used" class="management__row">
      <div>Allow manager to keep updating NAV</div>
      <v-switch
        :model-value="allowManagerToUpdateNav"
        color="primary"
        hide-details
        @update:model-value="(v) => emit('update:allowManagerToUpdateNav', v as boolean)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fundFactoryContractV2Used: boolean;
  allowManagerToSendFundsToFundContract: boolean;
  allowManagerToCollectFees: boolean;
  allowManagerToUpdateNav: boolean;
}>();

const emit = defineEmits<{
  (e: "update:allowManagerToSendFundsToFundContract", value: boolean): void;
  (e: "update:allowManagerToCollectFees", value: boolean): void;
  (e: "update:allowManagerToUpdateNav", value: boolean): void;
}>();
</script>

<style scoped lang="scss">
.management {
  margin-bottom: 1rem;
  &__row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
