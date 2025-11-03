<template>
  <Icon
    :icon="chainIcon?.name || 'octicon:question-16'"
    :width="chainIcon?.size"
    :height="chainIcon?.size"
    :color="chainIcon?.color"
  />
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import { networksMap } from "~/store/web3/networksMap";

const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  chainShort: {
    type: String,
    default: "",
  },
});

const chainIcon = computed(() => {
  if (!props.chainShort && props.chainId) {
    return networksMap[props.chainId].icon;
  }

  return getChainIcon(props.chainShort)
});
</script>

<style lang="scss" scoped>
</style>
