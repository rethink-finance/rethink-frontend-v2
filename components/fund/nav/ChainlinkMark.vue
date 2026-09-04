<template>
  <svg
    class="chainlink_mark"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Chainlink"
    :style="{ '--chainlink-mark-size': `${size}px` }"
  >
    <!-- The Chainlink hexagonal ring: a regular hexagon with a concentric
         hexagonal hole, in Chainlink's blue. -->
    <path
      fill="#375BD2"
      fill-rule="evenodd"
      d="M12 1 21.53 6.5v11L12 23 2.47 17.5v-11L12 1Zm0 5.5L7.24 9.25v5.5L12 17.5l4.76-2.75v-5.5L12 6.5Z"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * Chainlink's mark, drawn inline so it stays crisp at chip size and needs
 * no icon service: the NAV library shows it wherever a price comes from a
 * Chainlink feed, so the data source is never a guess.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 16 });
</script>

<style scoped lang="scss">
.chainlink_mark {
  flex: none;
  width: var(--chainlink-mark-size);
  height: var(--chainlink-mark-size);
}
</style>
