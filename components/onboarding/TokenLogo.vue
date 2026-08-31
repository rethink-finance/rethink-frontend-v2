<template>
  <img
    v-if="src"
    class="token_logo"
    :src="src"
    :alt="symbol"
    :style="{ '--token-logo-size': `${size}px` }"
    @error="markFailed"
  >
  <Icon
    v-else-if="iconifyFallback"
    :icon="iconifyFallback.name"
    :width="size"
    :height="size"
    :color="iconifyFallback.color"
  />
</template>

<script setup lang="ts">
import { getTokenLogoUrl } from "~/composables/permissions/protocolPermissions";
import {
  getAssetIcon,
  getAssetIconBySymbol,
  networksMap,
} from "~/store/web3/networksMap";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Token mark with full coverage: the design system's own PNGs first, then
 * DefiLlama's icon service by chain + address (the zero address is the
 * chain's native asset, which is how the native symbol with no token
 * address — "ETH" — still gets its mark; any OTHER addressless symbol must
 * skip DefiLlama, or it would wear the native mark), then the Iconify
 * fallbacks the rest of the app uses. Each failing source drops to the
 * next, so a token DefiLlama has never heard of degrades the same way
 * IconBaseAsset does instead of showing a broken-image glyph.
 */
const props = defineProps<{
  chainId: ChainId;
  symbol: string;
  tokenAddress?: string;
  size?: number;
}>();

const size = computed(() => props.size ?? 16);

/**
 * Icon lookup only — bridged/rebranded symbols map onto the marks the
 * design system ships under their canonical names.
 */
const ICON_SYMBOL_ALIASES: Record<string, string> = {
  "USDC.e": "USDC",
  "USD₮0": "USDT",
};

const failedSources = ref<Set<string>>(new Set());

/** Whether the symbol IS the chain's native asset — the one case where the
 * zero-address (native-mark) DefiLlama fallback is the right picture. */
const isNativeAsset = computed(
  () =>
    props.symbol.toUpperCase() ===
    networksMap[props.chainId]?.nativeCurrency?.symbol?.toUpperCase(),
);

const candidates = computed(() => {
  const list: string[] = [];
  const designIcon = getDesignTokenIcon(
    ICON_SYMBOL_ALIASES[props.symbol] ?? props.symbol,
  );
  if (designIcon) list.push(designIcon);
  if (props.tokenAddress || isNativeAsset.value) {
    const llamaIcon = getTokenLogoUrl(props.chainId, props.tokenAddress);
    if (llamaIcon) list.push(llamaIcon);
  }
  return list.filter((source) => !failedSources.value.has(source));
});

const src = computed(() => candidates.value[0]);

const markFailed = () => {
  if (!src.value) return;
  failedSources.value = new Set([...failedSources.value, src.value]);
};

const iconifyFallback = computed(() =>
  src.value
    ? undefined
    : (getAssetIconBySymbol(props.symbol) ??
      getAssetIcon(props.chainId, props.tokenAddress ?? "")),
);
</script>

<style scoped lang="scss">
.token_logo {
  display: inline-block;
  flex: none;
  width: var(--token-logo-size);
  height: var(--token-logo-size);
  object-fit: contain;
  border-radius: 999px;
}
</style>
