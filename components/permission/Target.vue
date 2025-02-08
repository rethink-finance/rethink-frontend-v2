<template>
  <div class="target">
    <div>
      <strong>Target Address:</strong>
      {{ target?.address }}
    </div>

    <UiDataRowCard
      no-body-padding
      bg-transparent
      class="target__abi_fetch_card"
    >
      <template #title>
        <div
          class="target__abi_fetch_text"
        >
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
            Unable to fetch ABI for this address.
            Upload contract ABI.
          </template>
        </div>

      </template>
      <template #actionText>
        Show ABI
      </template>
      <template #body>
        <v-btn
          v-if="!isEditingCustomABI"
          color="primary"
          class="target__abi_edit_button"
          @click="handleClickEditCustomABI"
        >
          Edit ABI
        </v-btn>

        <v-col
          v-if="isEditingCustomABI"
        >
          <v-textarea
            v-model="customABI"
            label="Custom ABI"
            placeholder="Enter the contract ABI here"
            rows="25"
          />
          <div class="d-flex">
            <v-btn
              color="primary"
              class="mr-2"
              @click="submitCustomABI"
            >
              Submit custom ABI
            </v-btn>
            <v-btn
              variant="text"
              @click="handleClickEditCustomABI"
            >
              Cancel
            </v-btn>
          </div>
        </v-col>

        <pre
          v-else
          class="permissions__json"
        >{{ JSON.stringify(abiDetectedFunctions, null, 4) }}</pre>
      </template>
    </UiDataRowCard>

    <div v-if="!isFetchingTargetABI" class="permissions__list">
      <!-- Display functions that were found in the ABI -->
      <PermissionTargetFunction
        v-for="(func, index) in abiDetectedFunctions"
        :key="index"
        v-model:funcConditions="localConditions[func.selector]"
        :func="func as FunctionFragment"
      />
      <!-- Display function conditions that were not found in the ABI -->
      <PermissionTargetFunction
        v-for="(sighash, index) in sighashesNotInAbi"
        :key="index"
        v-model:funcConditions="localConditions[sighash]"
        :sighash="sighash"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import { getWriteFunctions } from "~/composables/zodiac-roles/conditions";
import type { Explorer } from "~/services/explorer";
import { useToastStore } from "~/store/toasts/toast.store";
import type { ChainId } from "~/store/web3/networksMap";
import type { Target, TargetConditions } from "~/types/zodiac-roles/role";

const emit = defineEmits(["update:conditions"]);

const props = defineProps({
  target: {
    type: Object as PropType<Target>,
    default: () => {},
  },
  conditions: {
    type: Object as PropType<TargetConditions>,
    default: () => {},
  },
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
});

const { $getExplorer } = useNuxtApp();
const toastStore = useToastStore();
// 🔥 **Create a local reactive copy of `target.conditions`**
const localConditions = ref({ ...props.conditions });

const customABI = ref<string>("");
const isEditingCustomABI = ref(false);

const submitCustomABI = () => {
  try {
    const customABIJson = JSON.parse(customABI.value);
    const writeFunctions: FunctionFragment[] = getWriteFunctions(customABIJson);
    abiDetectedFunctions.value = writeFunctions;
    console.log("Custom ABI detected functions", writeFunctions);
    isEditingCustomABI.value = false;
  } catch (error: any) {
    console.error("Error parsing custom ABI", error);
    toastStore.errorToast("Error parsing custom ABI: " + error.message);
  }
}

const handleClickEditCustomABI = () => {
  customABI.value = JSON.stringify(abiDetectedFunctions.value, null, 4);
  isEditingCustomABI.value = !isEditingCustomABI.value;
}

// Functions from the detected ABI.
const abiDetectedFunctions = ref<FunctionFragment[]>([]);
// Condition sighashes of functions that are not in the detected ABI.
const sighashesNotInAbi = ref<string[]>([]);
const isFetchingTargetABI = ref(false);

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
    const writeFunctions: FunctionFragment[] = getWriteFunctions(resultAbiJson);
    abiDetectedFunctions.value = writeFunctions;
    console.log("fetched ABI abiDetectedFunctions", abiDetectedFunctions.value);
    isFetchingTargetABI.value = false;

    sighashesNotInAbi.value = Object.keys(props.target?.conditions || {}).filter(
      (conditionKey: string) => !writeFunctions?.some(
        (func: FunctionFragment) => func.selector === conditionKey,
      ),
    )
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
    isEditingCustomABI.value = false;
  },
  { immediate: true },
);

// Watch for changes in `localConditions` and emit updates to parent
watch(
  localConditions,
  (newConditions) => {
    if (JSON.stringify(newConditions) !== JSON.stringify(props.conditions)) {
      console.log("  [1] watch localConditions", toRaw(newConditions))
      emit("update:conditions", newConditions);
    }
  },
  { deep: true },
);

// Sync `localConditions` when `props.conditions` changes (but prevent looping)
watch(
  () => props.conditions,
  (newConditions) => {
    if (JSON.stringify(newConditions) !== JSON.stringify(localConditions.value)) {
      console.log("  [1] watch props.conditions")
      localConditions.value = { ...newConditions };
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
.target {
  display: flex;
  padding: 1rem;

  &__abi_fetch_card {
    border: 1px solid $color-gray-transparent;
    background-color: $color-badge-navy;
    margin: 1rem 0 1.5rem 0;
  }
  &__abi_fetch_text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  &__abi_edit_button {
    display:flex;
    margin: 1rem 1rem 1rem auto;
  }
}

:deep(.data_row__body) {
  max-height: 600px;
  overflow-y: auto;
}
</style>
