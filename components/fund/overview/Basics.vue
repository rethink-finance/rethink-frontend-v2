<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.fundToken?.symbol" subtitle="Vault Token Symbol" />
    <UiDataRowCard :title="fund.baseToken?.symbol" subtitle="Denomination Asset" />
    <UiDataRowCard subtitle="Safe Contract">
      <template #title>
        <AddressLink :address="fund.safeAddress" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
    <UiDataRowCard subtitle="Admin Contract">
      <template #title>
        <AddressLink :address="fund.fundToken?.address" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
    <UiDataRowCard subtitle="Roles Modifier Contract">
      <template #title>
        <AddressLink :address="roleModAddress" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import AddressLink from "~/components/common/AddressLink.vue";
const fundStore = useFundStore();

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const roleModAddress = ref("");

watch(
  () => props.fund?.address,
  async () => {
    if (!props.fund?.address) {
      roleModAddress.value = "";
    } else {
      roleModAddress.value = await fundStore.fetchRoleModAddress(props.fund?.address);
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
</style>
