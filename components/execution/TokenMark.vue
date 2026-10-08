<template>
  <img
    v-if="src"
    :src="src"
    :alt="symbol"
    class="token_mark"
    :style="{ width: size, height: size }"
  >
  <span
    v-else
    class="token_mark token_mark--fallback"
    :style="{ width: size, height: size }"
    :title="symbol"
  >{{ symbol.slice(0, 1) }}</span>
</template>

<script setup lang="ts">
import { getDesignTokenIcon } from "~/composables/designSystemIcons";

/**
 * A token's mark from the design system's icon set, or a monogram when the
 * set has none for it (AERO). Never an Iconify glyph.
 */
const props = withDefaults(defineProps<{ symbol: string; size?: string }>(), {
  size: "22px",
});

const src = computed(() => getDesignTokenIcon(props.symbol));
</script>

<style scoped lang="scss">
.token_mark {
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  flex: 0 0 auto;

  &--fallback {
    background: $color-cyan-tint;
    border: 1px solid $color-cyan-line;
    color: $color-cyan;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
  }
}
</style>
