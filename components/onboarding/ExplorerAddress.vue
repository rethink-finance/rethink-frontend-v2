<template>
  <span class="explorer_address">
    <!-- The name is a name; only the address itself is the link. -->
    <span v-if="label" class="explorer_address__label">{{ label }}</span>
    <a
      v-if="href"
      class="explorer_address__link"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      :title="`${address} · open in the block explorer`"
    >
      <span class="explorer_address__hex">{{ short }}</span>
      <Icon
        class="explorer_address__icon"
        icon="material-symbols:open-in-new-rounded"
        width="0.75rem"
        height="0.75rem"
      />
    </a>
    <span v-else class="explorer_address__hex" :title="address">{{ short }}</span>
  </span>
</template>

<script setup lang="ts">
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { type ChainId, getExplorerUrl } from "~/types/enums/chain_id";

/**
 * An address in the create flow: its name when one is known, then the
 * shortened hex as a link to the chain's block explorer. The full address is
 * the link's tooltip.
 */
const props = defineProps<{
  address: string;
  chainId?: ChainId;
  /** A name for the address, shown before the hex. */
  label?: string;
}>();

const short = computed(() => truncateAddressEllipsis(props.address));

const href = computed(() => {
  if (!props.chainId || !/^0x[0-9a-fA-F]{40}$/.test(props.address)) return "";
  const url = getExplorerUrl(props.chainId, props.address);
  // getExplorerUrl hands the input back when the chain has no explorer.
  return url.startsWith("http") ? url : "";
});
</script>

<style scoped lang="scss">
.explorer_address {
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  max-width: 100%;
  color: $color-white;

  &__label {
    font-weight: 600;
  }

  &__link {
    display: inline-flex;
    align-items: baseline;
    gap: 0.375rem;
    text-decoration: none;
  }

  &__hex {
    font-family: $font-mono;
    font-size: 0.92em;
    color: $color-steel-blue;
    transition: color $default-transition-time ease;
  }

  &__icon {
    flex: none;
    align-self: center;
    color: $color-steel-blue;
    transition: color $default-transition-time ease;
  }

  &__link:hover,
  &__link:focus-visible {
    outline: none;

    .explorer_address__hex,
    .explorer_address__icon {
      color: $color-cyan;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__hex,
    &__icon {
      transition: none;
    }
  }
}
</style>
