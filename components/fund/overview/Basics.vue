<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.fundToken?.symbol" subtitle="Vault Token Symbol" />
    <UiDataRowCard :title="fund.baseToken?.symbol" subtitle="Denomination Asset" />
    <UiDataRowCard :title="fund.safeAddress" subtitle="Safe Contract" />
    <UiDataRowCard :title="fund.fundToken?.address" subtitle="Admin Contract" />
    <UiDataRowCard
      :title="roleModAddress"
      subtitle="Roles Modifier Contract"
    />
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
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
