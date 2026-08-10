<template>
  <div
    class="vault_tile"
    :class="{ 'vault_tile--bare': image && !failed }"
    :style="{
      '--vault-tile-size': `${size}px`,
      '--vault-tile-symbol-size': `${symbolSize}px`,
    }"
  >
    <img
      v-if="image && !failed"
      class="vault_tile__image"
      :src="image"
      :alt="symbol"
      @error="failed = true"
    >
    <!-- Curators supply their own logos, so plenty of vaults have none and a
         few have a URL that no longer resolves. The ticker is a better answer
         than a broken-image glyph, and it is the one the design draws. -->
    <span v-else class="vault_tile__symbol">{{ symbol }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * A vault's logo at a fixed size, falling back to its ticker on a tinted tile.
 */
const props = withDefaults(
  defineProps<{
    image?: string;
    symbol?: string;
    /** Edge length in px. The design uses 38 in tables and 24 in lists. */
    size?: number;
  }>(),
  { image: "", symbol: "", size: 38 },
);

const failed = ref(false);

// A ticker is up to five characters, so the type has to scale with the tile
// rather than sit at one size: 10px in the design's 38px tile, 7px in its 24px
// one, which is what this ratio reproduces.
const symbolSize = computed(() => Math.max(7, Math.round(props.size * 0.26)));

// A vault whose logo failed is not the same vault after the row is reused.
watch(
  () => props.image,
  () => {
    failed.value = false;
  },
);
</script>

<style lang="scss" scoped>
.vault_tile {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--vault-tile-size);
  height: var(--vault-tile-size);
  border-radius: $default-border-radius;
  background: $color-accent-soft;
  border: 1px solid $color-accent-line;
  overflow: hidden;

  /* The tint and its edge exist to make a bare ticker read as a tile. A logo
     is already a tile, and framing it just draws a ring round someone's mark. */
  &--bare {
    background: none;
    border-color: transparent;
  }

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__symbol {
    padding: 0 0.125rem;
    font-family: $font-mono;
    font-size: var(--vault-tile-symbol-size);
    font-weight: 500;
    line-height: 1;
    text-align: center;
    color: $color-cyan;
    @include ellipsis;
  }
}
</style>
