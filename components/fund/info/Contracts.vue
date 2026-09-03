<template>
  <div class="fund_contracts brand_card">
    <div class="brand_card__eyebrow fund_contracts__title">
      Contracts
    </div>
    <div class="fund_contracts__rows">
      <div class="fund_contracts__row fund_contracts__row--head">
        <div class="fund_contracts__th">
          Contract
        </div>
        <div class="fund_contracts__th fund_contracts__th--right">
          Address
        </div>
      </div>
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
import { readCachedFundOverview } from "~/store/funds/fundOverviewCache";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const fundStore = useFundStore();

// Not on the fund object — read from the admin contract, same as the old
// Basics table did.
// Last visit's answer holds the row while the Safe is asked again: the store
// does not keep this across visits, and the row used to land a beat after
// the rest of the card.
const roleModAddress = ref("");
watch(
  () => props.fund?.address,
  async () => {
    const address = props.fund?.address;
    const chainId = props.fund?.chainId;
    roleModAddress.value =
      address && chainId
        ? (readCachedFundOverview(chainId, address)?.roleModAddress ?? "")
        : "";
    if (!address) return;
    try {
      const fresh = await fundStore.fetchRoleModAddress(address);
      if (props.fund?.address === address) roleModAddress.value = fresh;
    } catch (error) {
      console.warn("Failed fetching the Roles modifier address", error);
    }
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
    margin-bottom: 1rem;
  }

  &__rows {
    display: flex;
    flex-direction: column;
  }

  /* Built to the fee table's row, since the two sit side by side: the same
     heading strip, the same 116px column for the figure on the right, the same
     rule above each row. Paired cards that keep their own rhythms read as two
     things that happen to be adjacent rather than one band. */
  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 116px;
    align-items: center;
    column-gap: 1rem;
    min-width: 0;
    padding: 0.75rem 0;
    border-top: 1px solid $color-line;

    &--head {
      padding: 0 0 0.625rem;
      border-top: 0;
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }
  }

  &__label {
    font-size: 13.5px;
    color: $color-text-irrelevant;
  }

  &__address {
    justify-self: end;
    font-family: $font-mono;
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
