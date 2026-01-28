<template>
  <div class="main_grid">
    <UiDataRowCard
      :title="fund.fundToken?.symbol"
      subtitle="Vault Token Symbol"
    >
      <template #title>
        <AddressLink
          :title="fund.baseToken?.symbol"
          :address="fund.address"
          :chain-id="fund.chainId"
        />
      </template>
    </UiDataRowCard>
    <UiDataRowCard
      :title="fund.baseToken?.symbol"
      subtitle="Denomination Asset"
    />
    <UiDataRowCard subtitle="Safe Contract">
      <template #title>
        <AddressLink :address="fund.safeAddress" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
    <UiDataRowCard subtitle="Admin Contract">
      <template #title>
        <AddressLink
          :address="fund.fundToken?.address"
          :chain-id="fund.chainId"
        />
      </template>
    </UiDataRowCard>
    <UiDataRowCard subtitle="Roles Modifier Contract">
      <template #title>
        <div class="d-flex align-center justify-space-between">
          <AddressLink :address="roleModAddress" :chain-id="fund.chainId" />

          <UiLinkExternalButton
            v-if="fund.fundFactoryContractV2Used"
            title="Roles V2"
            density="compact"
            size="sm"
            :href="gnosisRolesUrl"
            class="ml-2 pa-2"
          />
        </div>
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import AddressLink from "~/components/common/AddressLink.vue";
import UiLinkExternalButton from "~/components/global/ui/LinkExternalButton.vue";
const fundStore = useFundStore();

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const roleModAddress = ref("");

const gnosisRolesUrl = computed(() => {
  if (!props.fund?.chainShort || !roleModAddress.value) return "";
  return `https://roles.gnosisguild.org/${props.fund.chainShort}:${roleModAddress.value}`;
});

watch(
  () => props.fund?.address,
  async () => {
    if (!props.fund?.address) {
      roleModAddress.value = "";
    } else {
      roleModAddress.value = await fundStore.fetchRoleModAddress(
        props.fund?.address,
      );
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped></style>
