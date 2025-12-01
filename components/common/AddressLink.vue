<template>
  <a
    v-if="blockscoutUrl"
    :href="blockscoutUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="address-link"
  >
    {{ displayAddress }}
  </a>
  <span v-else class="address-text">
    {{ displayAddress }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getBlockscoutUrl } from "~/types/enums/chain_id";
import { isZeroAddress } from "~/composables/addressUtils";

const props = defineProps({
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

const blockscoutUrl = computed(() => {
  if (!props.address || isZeroAddress(props.address)) {
    return null;
  }

  return getBlockscoutUrl(props.chainId, props.address);
});

const displayAddress = computed(() => {
  if (!props.address) return "N/A";
  if (isZeroAddress(props.address)) return "N/A";

  if (props.truncate) {
    return `${props.address.substring(0, 6)}...${props.address.substring(props.address.length - 4)}`;
  }

  return props.address;
});
</script>

<style lang="scss" scoped>
.address-link {
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.address-text {
  color: inherit;
}
</style>
