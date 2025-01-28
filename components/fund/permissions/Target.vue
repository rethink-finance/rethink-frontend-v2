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
            size="22"
            width="2"
            class="me-2"
          />
          Fetching contract ABI
        </template>
        <template v-else-if="abiDetectedWriteFunctions.length">
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
      <template
        v-if="abiDetectedWriteFunctions.length && !isFetchingTargetABI"
      >
        <div class="permissions__list">
          <div
            v-for="func in abiDetectedWriteFunctions"
            :key="func.selector"
            class="permissions__list_item"
          >
            <span>
              {{ func.name }}
            </span>
            <span class="permissions__target_params">
              {{ getParamsTypesTitle(func as FunctionFragment) }}
            </span>
          </div>
        </div>
        <pre class="permissions__target_abi_json">{{ JSON.stringify(abiDetectedWriteFunctions, null, 4) }}</pre>
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
import { getParamsTypesTitle } from "~/composables/zodiac-roles/target";

const { $getExplorer } = useNuxtApp();
const toastStore = useToastStore();
const abiDetectedWriteFunctions = ref<FunctionFragment[]>([]);
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
  abiDetectedWriteFunctions.value = [];
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
    abiDetectedWriteFunctions.value = getWriteFunctions(resultAbiJson);
    console.log("fetched ABI abiDetectedWriteFunctions", abiDetectedWriteFunctions.value);
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
  &__target_abi_json {
    color: #dcdcaa;
    padding: 10px;
    font-size: 0.85rem;
    white-space: pre-wrap;
    background-color: $color-badge-navy;
    border: 1px solid $color-gray-transparent;
    margin-top: 2rem;
  }
  &__target_params {
    color: $color-steel-blue;
    margin-left: 0.3rem;
  }
  &__target_abi_fetch_text {
    display: flex;
    align-items: center;
    margin: 1rem 0;
    gap: 0.25rem;
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
