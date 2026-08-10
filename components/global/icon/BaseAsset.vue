<template>
  <img
    v-if="designIcon"
    class="base_asset_icon"
    :src="designIcon"
    :alt="symbol"
    :style="{ '--base-asset-icon-size': `${size}px` }"
  >
  <!-- The fallback takes the same diameter, so a vault holding DAI does not
       sit taller in a row than one holding USDC. Nothing at all where the
       token has no mark: a vault's own share token never will have one, and a
       placeholder disc beside it only repeats the symbol already there. -->
  <Icon
    v-else-if="assetIcon"
    :icon="assetIcon.name"
    :width="size"
    :height="size"
    :color="assetIcon.color"
  />
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import {
  getAssetIcon,
  getAssetIconBySymbol,
  getTokenSymbolByAddress,
} from "~/store/web3/networksMap";

/**
 * Token logo, taken from the design system whenever it ships one. Iconify
 * stands in only for tokens the design system does not cover — DAI today.
 * Where neither has a mark, the component draws nothing rather than a
 * placeholder, so a vault share token reads as its symbol alone.
 *
 * Sized to match the chain marks — see ICON_SIZE_PX in designSystemIcons.
 */
const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  chainShort: {
    type: String,
    default: "",
  },
  tokenAddress: {
    type: String,
    default: "",
  },
  /**
   * Preferred when the caller knows it. The address lookup only covers the
   * base assets the app lists, so a symbol resolves tokens that map does not.
   */
  symbol: {
    type: String,
    default: "",
  },
  /** Diameter in px. Shared with IconChain so the two always agree. */
  size: {
    type: Number,
    default: ICON_SIZE_PX,
  },
});

const symbol = computed(
  () =>
    props.symbol || getTokenSymbolByAddress(props.chainId, props.tokenAddress),
);

const designIcon = computed(() => getDesignTokenIcon(symbol.value));

/**
 * Symbol first: the address lookup answers with a plain grey disc for anything
 * outside the base-asset map, and callers that pass a symbol alone — the
 * portfolio's rows — have no address for it to read at all. That left DAI, the
 * one token the design system does not ship, with no mark anywhere but the
 * places that happened to know its address.
 */
const assetIcon = computed(
  () =>
    getAssetIconBySymbol(symbol.value) ??
    getAssetIcon(props.chainId, props.tokenAddress),
);
</script>

<style lang="scss" scoped>
.base_asset_icon {
  display: inline-block;
  flex: none;
  width: var(--base-asset-icon-size);
  height: var(--base-asset-icon-size);
  /* Every token mark in the set is drawn on its own round field, so it needs
     no chip of its own — only a guard against a future one being off-square. */
  object-fit: contain;
  border-radius: 999px;
}
</style>
