<template>
  <img
    class="refi_mark"
    src="@/assets/images/logo_mobile.svg"
    alt="REFI"
    :style="{ '--refi-mark-size': `${size}px` }"
  >
</template>

<script setup lang="ts">
/**
 * The REFI token's mark: the Rethink glyph, which is already a circle, drawn
 * bare like the other token icons. Nothing behind it; a disc doubles the ring.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 18 });
</script>

<style scoped lang="scss">
.refi_mark {
  display: inline-block;
  flex: none;
  width: var(--refi-mark-size);
  height: var(--refi-mark-size);
  vertical-align: -0.15em;
}
</style>
