<template>
  <div
    class="tabs"
    :class="`tabs--${size}`"
    role="tablist"
    aria-label="Asset"
  >
    <button
      v-for="option in VENTURE_STAKING_ASSETS"
      :key="option.symbol"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'tabs__tab--active': option.symbol === modelValue }"
      :aria-selected="option.symbol === modelValue"
      @click="emit('update:modelValue', option.symbol)"
    >
      <IconChain v-if="option.symbol === 'ETH'" chain-short="eth" :size="iconSize" />
      <IconBaseAsset v-else :symbol="option.symbol" :size="iconSize" />
      {{ option.symbol }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { VENTURE_STAKING_ASSETS, type VentureAsset } from "~/composables/staking/ventureStakingConfig";

/** The ETH / WBTC / USDC switch, with each asset's mark. */
const props = withDefaults(
  defineProps<{
    modelValue: VentureAsset["symbol"];
    size?: "large" | "small";
  }>(),
  { size: "large" },
);

const emit = defineEmits<{ "update:modelValue": [symbol: VentureAsset["symbol"]] }>();

const iconSize = computed(() => (props.size === "large" ? 18 : 15));
</script>

<style scoped lang="scss">
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &--small {
    display: inline-grid;
    padding: 0.1875rem;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 0.5rem;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: $text-sm;
    letter-spacing: 0.06em;
    color: $color-subtitle;
    transition: background $default-transition-time, color $default-transition-time;

    &:hover {
      color: $color-title;
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
    }

    &--active {
      background: var(--fill-2);
      color: $color-title;
    }
  }

  &--small &__tab {
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem;
    font-size: $text-xs;
  }
}
</style>
