<template>
  <!-- Spot prices are not a protocol: their source is Chainlink, and the
       mark says so wherever the library lists them. -->
  <FundNavChainlinkMark
    v-if="protocol === 'spot'"
    :size="size"
  />
  <img
    v-else-if="!failed"
    class="protocol_logo"
    :src="getProtocolLogoUrl(protocol)"
    :alt="`${label} logo`"
    :style="sizeStyle"
    @error="failed = true"
  >
  <span
    v-else
    class="protocol_logo protocol_logo--fallback"
    :style="sizeStyle"
    aria-hidden="true"
  >
    {{ label.charAt(0) }}
  </span>
</template>

<script setup lang="ts">
import { getProtocolLogoUrl } from "~/composables/permissions/protocolPermissions";

/**
 * A protocol's mark: DefiLlama's icon by slug, and the first letter of the
 * name in a disc when that fails to load — so a protocol the icon service
 * has never heard of degrades to something that still reads as a mark
 * rather than to a broken-image glyph.
 */
const props = withDefaults(
  defineProps<{
    protocol: string;
    label: string;
    size?: number;
  }>(),
  { size: 28 },
);

const failed = ref(false);

// A different protocol is a different image; give it its own chance.
watch(
  () => props.protocol,
  () => {
    failed.value = false;
  },
);

const sizeStyle = computed(() => ({
  "--protocol-logo-size": `${props.size}px`,
}));
</script>

<style scoped lang="scss">
.protocol_logo {
  flex: none;
  width: var(--protocol-logo-size);
  height: var(--protocol-logo-size);
  object-fit: contain;
  border-radius: 999px;

  &--fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid $color-line-2;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }
}
</style>
