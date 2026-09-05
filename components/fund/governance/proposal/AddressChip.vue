<template>
  <span class="address_chip" :title="address">
    <AddressLink
      :address="address"
      :chain-id="chainId"
      :title="text"
      class="address_chip__link"
    />
  </span>
</template>

<script setup lang="ts">
import AddressLink from "~/components/common/AddressLink.vue";
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { useFundStore } from "~/store/fund/fund.store";
import type { ProposalAddressLabels } from "~/composables/proposal/useProposalAddressLabels";

/**
 * An address as a reader wants it: named when we know the name, shortened
 * always, and a link to the explorer. The full hex sits in the tooltip.
 */
const props = defineProps<{
  address: string;
}>();

const fundStore = useFundStore();
const chainId = computed(() => fundStore.selectedFundChain);
const labels = inject<ProposalAddressLabels | undefined>("proposalAddressLabels", undefined);

watch(
  () => props.address,
  (address) => labels?.resolve([address]),
  { immediate: true },
);

const text = computed(() => {
  const label = labels?.labelFor(props.address);
  const short = truncateAddressEllipsis(props.address);
  return label ? `${label} · ${short}` : short;
});
</script>

<style scoped lang="scss">
.address_chip {
  display: inline;
  word-break: break-word;

  &__link {
    color: $color-white;
    font-size: inherit;
    text-decoration: none;
    border-bottom: 1px dotted $color-line-2;
    transition: color $default-transition-time ease, border-color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      border-color: $color-cyan;
      text-decoration: none;
    }
  }
}
</style>
