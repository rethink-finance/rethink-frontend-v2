<template>
  <div class="main_grid">
    <UiDataRowCard :title="depositsTitle">
      <template #body>
        <div v-if="fund?.allowedDepositAddresses?.length">
          <div v-for="(address, index) in fund.allowedDepositAddresses" :key="index" class="address-item">
            <AddressLink :address="address" :chain-id="fund.chainId" />
          </div>
        </div>
        <div v-else>
          There are currently no whitelisted deposit addresses.
        </div>
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});

const depositsTitle = computed(() => {
  const addressCount = props.fund?.allowedDepositAddresses?.length ?? 0;
  if (addressCount === 1) {
    return `${addressCount} Address`;
  }
  return `${addressCount} Addresses`;
});
</script>

<style lang="scss" scoped>
.address-item {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}
</style>
