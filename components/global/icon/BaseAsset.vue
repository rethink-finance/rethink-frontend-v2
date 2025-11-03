<template>
  <Icon
    :icon="assetIcon?.name || 'octicon:question-16'"
    :width="assetIcon?.size"
    :height="assetIcon?.size"
    :color="assetIcon?.color"
  />
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import { getAssetIcon } from "~/store/web3/networksMap";

const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  chainShort: {
    type: String,
    default: "",
  },
  tokenAddress: {
    type: String,
    default: "",
  },
});

const assetIcon = computed(() => {
  return getAssetIcon(props.chainId, props.tokenAddress);
});
</script>

<style lang="scss" scoped>
</style>
