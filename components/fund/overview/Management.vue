<template>
  <div class="main_grid">
    <UiDataRowCard
      :title="parsedPlannedSettlement"
      subtitle="Planned Settlement Cycle"
    />
    <UiDataRowCard
      :title="fund.minLiquidAssetShare || 'N/A'"
      subtitle="Min. Liquid Asset Share "
    />
    <UiDataRowCard :title="managementTitle" subtitle="Management">
      <template #body>
        <div v-if="fund?.allowedManagerAddresses?.length">
          <div v-for="(address, index) in fund.allowedManagerAddresses" :key="index" class="address-item">
            <AddressLink :address="address" :chain-id="fund.chainId" />
          </div>
        </div>
        <div v-else>
          There are currently no manager addresses.
        </div>
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { parsePlannedSettlement } from "~/composables/fund/parsePlannedSettlement";
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});

const parsedPlannedSettlement = ref("");

const managementTitle = computed(() => {
  const addressCount = props.fund?.allowedManagerAddresses?.length ?? 0;
  if (addressCount === 1) {
    return `${addressCount} Address`;
  }
  return `${addressCount} Addresses`;
});

onMounted(async () => {
  try {
    const result = await parsePlannedSettlement(
      props.fund?.chainId,
      props.fund?.plannedSettlementPeriod,
    );
    parsedPlannedSettlement.value = result?.toString() || "";
  } catch (error) {
    console.error("Error parsing planned settlement", error);
  }
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
