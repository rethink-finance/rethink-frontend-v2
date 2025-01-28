<template>
  <div class="permissions__target">
    <div>
      <strong>Target Address:</strong>
      {{ target?.address }}
    </div>
    <div>
      Fetched ABI
      <pre class="permissions__target_json">
        {{ JSON.stringify(writeFunctions, null, 4) }}
      </pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import type { Target } from "~/types/zodiac-roles/role";
import type { ChainId } from "~/store/web3/networksMap";
import type { Explorer } from "~/services/explorer";
import { getWriteFunctions } from "~/composables/zodiac-roles/conditions";

const { $getExplorer } = useNuxtApp();
const writeFunctions = ref<FunctionFragment[]>([]);

const props = defineProps({
  target: {
    type: Object as PropType<Target>,
    default: () => {},
  },
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
});

const fetchTargetABI = async () => {
  console.log("Fetch target ABI");
  if (!props.target.address) return;
  // TODO fetch target ABI
  console.log("Fetch target ABI action", props.chainId);
  const explorer: Explorer = $getExplorer(props.chainId);
  console.log("Explorer:", explorer);

  try {
    const resultAbiJson = await explorer.abi(props.target.address)
    console.log("fetched ABI", resultAbiJson);
    writeFunctions.value = getWriteFunctions(resultAbiJson);
    console.log("fetched ABI writeFunctions", writeFunctions.value);
  } catch (error: any) {
    console.error(error);
  }
}

watch(
  () => props.target, () => {
    fetchTargetABI();
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.permissions {
  &__target {
    display: flex;
    padding: 1rem;
  }

  &__target_json {
    color: #dcdcaa;
    padding: 10px;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
}
</style>
