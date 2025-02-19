<template>
  <div class="target">
    <div class="d-flex align-center">
      <strong>Target Address:</strong>
      <div class="permissions__json ms-2">
        {{ target?.address }}
      </div>
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
          <template v-else-if="abiWriteFunctions.length">
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
        <div class="target__abi_fetch_card_body">
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
          >{{ JSON.stringify(abiWriteFunctions, null, 4) }}</pre>
        </div>
      </template>
    </UiDataRowCard>

    <div v-if="!isFetchingTargetABI" class="permissions__list">
      <!-- Display write functions that were found in the ABI -->
      <PermissionTargetFunction
        v-for="(func, index) in abiWriteFunctions"
        :key="index"
        :func="func as FunctionFragment"
        :disabled="disabled"
        :func-conditions="getFuncCondition(func.selector)"
        @update:func-conditions="(newFuncConditions) => updateConditions(func.selector, newFuncConditions)"
      />
      <!-- Display function conditions that were not found in the ABI -->
      <PermissionTargetFunction
        v-for="(sighash, index) in sighashesNotInAbi"
        :key="index"
        :sighash="sighash"
        :disabled="disabled"
        :func-conditions="getFuncCondition(sighash)"
        @update:func-conditions="(newFuncConditions) => updateConditions(sighash, newFuncConditions)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment, JsonFragment } from "ethers";
import { getWriteFunctions } from "~/composables/zodiac-roles/conditions";
import type { Explorer } from "~/services/explorer";
import { useToastStore } from "~/store/toasts/toast.store";
import type { ChainId } from "~/store/web3/networksMap";
import type { FunctionCondition, TargetConditions } from "~/types/zodiac-roles/role";
import type { RoleStoreType } from "~/store/role/role.store";
import { ConditionType, ExecutionOption } from "~/types/enums/zodiac-roles";

const props = defineProps({
  conditions: {
    type: Object as PropType<TargetConditions>,
    default: () => {},
  },
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Inject the Role Store
const roleStore = inject<RoleStoreType>("roleStore");
if (!roleStore) {
  throw new Error("roleStore is not provided!");
}

const target = computed(() => roleStore.activeTarget);

const { $getExplorer } = useNuxtApp();
const toastStore = useToastStore();

const targetABIJson = ref<JsonFragment[]>([]);
const customABI = ref<string>("");
const isEditingCustomABI = ref(false);

const getFuncCondition = (funcSelector: string): FunctionCondition => {
  return target?.value?.conditions[funcSelector] || {
    sighash: funcSelector,
    type: ConditionType.BLOCKED,
    executionOption: ExecutionOption.NONE,
    params: [],
  }
}

const submitCustomABI = () => {
  try {
    targetABIJson.value = JSON.parse(customABI.value);
    console.log("Custom ABI targetABIJson", targetABIJson.value);
    isEditingCustomABI.value = false;
  } catch (error: any) {
    console.error("Error parsing custom ABI", error);
    toastStore.errorToast("Error parsing custom ABI: " + error.message);
  }
}

const handleClickEditCustomABI = () => {
  customABI.value = JSON.stringify(abiWriteFunctions.value, null, 4);
  isEditingCustomABI.value = !isEditingCustomABI.value;
}

// Functions from the detected ABI.
const abiWriteFunctions = ref<FunctionFragment[]>([]);
// Condition sighashes of functions that are not in the detected ABI.
const sighashesNotInAbi = ref<string[]>([]);
const isFetchingTargetABI = ref(false);

// TODO: move this code to role.store and cache each targetABI in a map
const fetchTargetABI = async () => {
  targetABIJson.value = [];
  if (!target.value?.address) return;
  isFetchingTargetABI.value = true;
  console.log("Fetch target ABI action", props.chainId, target.value.address);

  let explorer: Explorer;
  try {
    explorer = $getExplorer(props.chainId);
  } catch (error: any) {
    return handleABIError(error);
  }

  try {
    targetABIJson.value = await explorer.abi(target.value.address);
    console.debug("fetched ABI targetABIJson", targetABIJson.value);
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
  () => targetABIJson.value, () => {
    // Update write functions when the ABI changes.
    const writeFunctions = getWriteFunctions(targetABIJson.value);
    abiWriteFunctions.value = writeFunctions;

    // Condition sighashes of functions that are not in the detected ABI.
    sighashesNotInAbi.value = Object.keys(target.value?.conditions || {}).filter(
      (conditionKey: string) => !writeFunctions?.some(
        (func: FunctionFragment) => func.selector === conditionKey,
      ),
    );
  },
  { immediate: true, deep: true },
);

watch(
  () => roleStore.activeTargetId, () => {
    fetchTargetABI();
    isEditingCustomABI.value = false;
  },
  { immediate: true },
);
const updateConditions = (sighash: string, newFuncConditions: FunctionCondition) => {
  console.log("[FATHER] Conditions changed for sighash", sighash, "New:", newFuncConditions);
  if (target.value?.id && target.value?.address) {
    console.log("[FATHER] Conditions changed for", target.value, "New:", { sighash, conditions: toRaw(newFuncConditions) });
    roleStore.handleTargetConditions(
      target.value.id,
      {
        ...target.value?.conditions,
        [sighash]: newFuncConditions,
      },
    );
  }
};
</script>

<style lang="scss" scoped>
.target {
  display: flex;

  &__abi_fetch_card {
    border: 1px solid $color-gray-transparent;
    background-color: $color-badge-navy;
    margin: 1rem 0 1.5rem 0;
  }
  &__abi_fetch_card_body {
    min-height: 7rem;
  }
  &__abi_fetch_text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  &__abi_edit_button {
    display:flex;
    margin: 1rem 1rem 1rem auto;
    position: absolute;
    right: 0;
  }
}

:deep(.data_row__body) {
  //max-height: 700px;
  overflow-y: auto;
}
</style>
