<template>
  <a
    v-if="explorerUrl"
    :href="explorerUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="address-link"
  >
    <slot>
      {{ displayAddress }}
    </slot>
  </a>
  <span v-else class="address-text">
    <slot>
      {{ displayAddress }}
    </slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getExplorerUrl } from "~/types/enums/chain_id";
import { isZeroAddress } from "~/composables/addressUtils";

const props = defineProps({
  title: {
    type: String,
    required: false,
    default: "",
  },
  address: {
    type: String,
    required: true,
  },
  chainId: {
    type: String,
    required: true,
  },
  truncate: {
    type: Boolean,
    default: false,
  },
});

const explorerUrl = computed(() => {
  if (!props.address || isZeroAddress(props.address)) {
    return null;
  }

  return getExplorerUrl(props.chainId, props.address);
});

const displayAddress = computed(() => {
  if (props.title) return props.title;

  if (!props.address) return "N/A";
  if (isZeroAddress(props.address)) return "N/A";

  if (props.truncate) {
    return `${props.address.substring(0, 6)}...${props.address.substring(props.address.length - 4)}`;
  }

  return props.address;
});
</script>

<style lang="scss" scoped>
/* Brand: hex data (addresses, tx hashes) renders in mono */
.address-link {
  font-family: $font-mono;
  font-size: 0.9em;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.address-text {
  font-family: $font-mono;
  font-size: 0.9em;
  color: inherit;
}
</style>
