<template>
  <span
    class="refi_mark"
    :style="{ '--refi-mark-size': `${size}px` }"
    role="img"
    aria-label="REFI"
  >
    <img src="@/assets/images/logo_mobile.svg" alt="">
  </span>
</template>

<script setup lang="ts">
/** The REFI token's mark: the Rethink glyph on a disc, sized like a token icon. */
withDefaults(defineProps<{ size?: number }>(), { size: 18 });
</script>

<style scoped lang="scss">
.refi_mark {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--refi-mark-size);
  height: var(--refi-mark-size);
  border-radius: 50%;
  background: var(--surface-3);
  vertical-align: middle;

  img {
    width: 64%;
    height: 64%;
  }
}
</style>
