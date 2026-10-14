<template>
  <OnboardingProtocolLogo
    v-if="kind === 'lido'"
    protocol="lido"
    label="Lido"
    :size="size"
  />
  <OnboardingProtocolLogo
    v-else-if="kind === 'cow'"
    protocol="cowswap"
    label="CoW Swap"
    :size="size"
  />
  <img
    v-else-if="kind === 'eth' && ethIcon"
    :src="ethIcon"
    alt="ETH"
    class="sci_mark"
    :style="box"
  >
  <ExecutionTokenMark
    v-else-if="kind === 'weth'"
    symbol="WETH"
    :size="`${size}px`"
  />
  <span
    v-else-if="GLYPHS[kind]"
    class="sci_mark sci_mark--glyph"
    :style="box"
    :title="TITLES[kind]"
  >
    <Icon :icon="GLYPHS[kind]" :width="Math.round(size * 0.72)" :height="Math.round(size * 0.72)" />
  </span>
</template>

<script setup lang="ts">
import { getDesignChainIcon } from "~/composables/designSystemIcons";
import type { SciMarkKind } from "~/composables/execution/sciEthConsole";

/**
 * Who a sciETH console action or position involves, as a mark: the
 * design system's ETH and WETH marks, Lido's and CoW's own logos, and a
 * plain glyph for the staking vault, the multisig and the vault contract,
 * which have none.
 */
const props = withDefaults(defineProps<{ kind: SciMarkKind; size?: number }>(), { size: 18 });

const GLYPHS: Partial<Record<SciMarkKind, string>> = {
  staking: "material-symbols:deployed-code-outline-rounded",
  wallet: "material-symbols:account-balance-wallet-outline-rounded",
  vault: "material-symbols:account-balance-outline-rounded",
};

const TITLES: Partial<Record<SciMarkKind, string>> = {
  staking: "w3.labs staking vault",
  wallet: "Yield multisig",
  vault: "Vault contract",
};

const ethIcon = getDesignChainIcon("eth");

const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
</script>

<style scoped lang="scss">
.sci_mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 50%;

  &--glyph {
    background: $color-cyan-tint;
    color: $color-cyan;
  }
}
</style>
