<template>
  <div class="fund_contracts brand_card">
    <div class="brand_card__eyebrow fund_contracts__title">
      Contracts
    </div>
    <div class="fund_contracts__rows">
      <div v-for="row in contractRows" :key="row.label" class="fund_contracts__row">
        <div class="fund_contracts__label">
          {{ row.label }}
        </div>
        <AddressLink
          :address="row.address"
          :chain-id="fund.chainId"
          truncate
          class="fund_contracts__address"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";
import { useFundStore } from "~/store/fund/fund.store";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const fundStore = useFundStore();

// Not on the fund object — read from the admin contract, same as the old
// Basics table did.
const roleModAddress = ref("");
watch(
  () => props.fund?.address,
  async () => {
    roleModAddress.value = props.fund?.address
      ? await fundStore.fetchRoleModAddress(props.fund.address)
      : "";
  },
  { immediate: true },
);

const contractRows = computed(() =>
  [
    { label: "Safe custody", address: props.fund?.safeAddress },
    { label: "Vault admin", address: props.fund?.address },
    { label: "Roles modifier", address: roleModAddress.value },
    { label: "Governance", address: props.fund?.governorAddress },
  ].filter((row) => row.address),
);
</script>

<style lang="scss" scoped>
.fund_contracts {
  &__title {
    margin-bottom: 0.5rem;
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
    min-width: 0;
    padding: 0.75rem 0;
    border-bottom: 1px solid $color-line;

    &:last-child {
      border-bottom: 0;
      padding-bottom: 0;
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

  &__address {
    font-size: 12.5px;
    color: $color-text-irrelevant;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      text-decoration: none;
    }
  }
}
</style>
