<template>
  <div class="permissions__target">
    <div>
      <strong>Target Address:</strong>
      {{ target?.address }}
    </div>
    <div>
      <div class="permissions__target_abi_fetch_text">
        <template v-if="isFetchingTargetABI">
          <v-progress-circular
            indeterminate
            color="gray"
            size="18"
            width="2"
          />
          Fetching contract ABI
        </template>
        <template v-else-if="abiDetectedFunctions.length">
          <Icon
            icon="weui:done-filled"
            width="1rem"
            height="1rem"
            color="var(--color-success)"
            class="mt-1"
          />
          Contract ABI detected
        </template>
        <template v-else>
          Unable to fetch ABI for this addrses.
          Upload contract ABI
          <!-- TODO upload ABI form input -->
        </template>
      </div>
      <div>
        <pre class="permissions__json">{{ JSON.stringify(target.conditions, null, 4) }}</pre>
      </div>
      <template
        v-if="abiDetectedFunctions.length && !isFetchingTargetABI"
      >
        <div class="permissions__list">
          <PermissionTargetFunction
            v-for="func in abiDetectedFunctions"
            :key="func.selector"
            :func="func as FunctionFragment"
            class="permissions__list_item"
          />
        </div>
        <pre class="permissions__json">{{ JSON.stringify(abiDetectedFunctions, null, 4) }}</pre>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import type { Target } from "~/types/zodiac-roles/role";
import type { ChainId } from "~/store/web3/networksMap";
import type { Explorer } from "~/services/explorer";
import { getWriteFunctions } from "~/composables/zodiac-roles/conditions";
import { useToastStore } from "~/store/toasts/toast.store";

const { $getExplorer } = useNuxtApp();
const toastStore = useToastStore();
const abiDetectedFunctions = ref<FunctionFragment[]>([]);
const isFetchingTargetABI = ref(false);
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
  abiDetectedFunctions.value = [];
  if (!props.target.address) return;
  isFetchingTargetABI.value = true;
  console.log("Fetch target ABI action", props.chainId, props.target.address);

  let explorer: Explorer;
  try {
    explorer = $getExplorer(props.chainId);
  } catch (error: any) {
    return handleABIError(error);
  }

  console.log("Explorer:", explorer);
  try {
    const resultAbiJson = await explorer.abi(props.target.address)
    console.log("fetched ABI", resultAbiJson);
    abiDetectedFunctions.value = getWriteFunctions(resultAbiJson);
    console.log("fetched ABI abiDetectedFunctions", abiDetectedFunctions.value);
    isFetchingTargetABI.value = false;
  } catch (error: any) {
    handleABIError(error);
  }
}

const handleABIError = (error: any) => {
  const errorMsg = "Something went wrong fetching target ABI.";

  isFetchingTargetABI.value = false;
  console.error(errorMsg, error);
  toastStore.errorToast(errorMsg + error.message);
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
  &__target_abi_fetch_text {
    display: flex;
    align-items: center;
    margin: 1rem 0;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid $color-gray-transparent;
    background-color: $color-badge-navy;
  }
  &__list_item {
    font-family: monospace;
    white-space: pre-wrap;
  }
}
</style>
