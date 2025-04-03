<template>
  <!--  TODO remove this -->
  <!--  <div class="permissions__json">-->
  <!--    {{ calldataDecoded }}-->
  <!--  </div>-->
  <!--  <div class="permissions__json">-->
  <!--    {{ functionAbi }}-->
  <!--  </div>-->
  <div class="d-flex">

    <div v-if="functionAbi?.selector" class="permissions__list flex-grow-1">
      <PermissionTargetFunction
        :func="functionAbi as FunctionFragment"
        disabled
        :func-conditions="getFuncCondition(functionAbi.selector)"
        only-show-condition-params
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment, JsonFragment } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { ChainId } from "~/types/enums/chain_id";
import {
  ExecutionOptionMap,
  getWriteFunctions,
  ParamComparisonMap,
  ParameterTypeMap,
} from "~/composables/zodiac-roles/conditions";
import type { FunctionCondition, ParamCondition } from "~/types/zodiac-roles/role";
import { ConditionType, ExecutionOption, ParamComparison, ParameterType } from "~/types/enums/zodiac-roles";
const fundStore = useFundStore();

const props = defineProps<{
  functionName: string | undefined;
  calldataDecoded: any;
  chainId: ChainId;
}>();
provide("chainId", props.chainId);

const targetABIJson = ref<JsonFragment[]>([]);
const isFetchingTargetABI = ref(false);
// TODO Duplicated code from Target.vue
// Functions from the detected ABI.
const abiWriteFunctions = ref<FunctionFragment[]>([]);
// Condition sighashes of functions that are not in the detected ABI.
const functionAbi = ref();

const getFuncCondition = (funcSelector: string): FunctionCondition => {
  if (funcSelector !== props.calldataDecoded?.functionSig) {
    return {
      sighash: funcSelector,
      type: ConditionType.BLOCKED,
      executionOption: ExecutionOption.NONE,
      params: [],
    }
  }
  return decodedCondition.value;
}

const decodedCondition = computed(() => {
  // TODO handle all cases
  const condition: FunctionCondition = {
    sighash: props.calldataDecoded?.functionSig,
    type: ConditionType.SCOPED,
    executionOption: ExecutionOptionMap[props.calldataDecoded?.options] as ExecutionOption,
    params: [],
  };
  if (props.functionName === "scopeParameter") {
    condition.params = [
      {
        index: props.calldataDecoded?.paramIndex,
        type: ParameterTypeMap[props.calldataDecoded?.paramType] as ParameterType,
        condition: ParamComparisonMap[props.calldataDecoded?.paramComp] as ParamComparison,
        value: [props.calldataDecoded?.compValue],
      } as ParamCondition,
    ]
  } else if (props.functionName === "scopeFunction") {
    for (let i = 0; i < props.calldataDecoded?.compValue?.length || 0; i++) {
      condition.params.push(
        {
          index: i,
          type: ParameterTypeMap[props.calldataDecoded?.paramType[i]] as ParameterType,
          condition: ParamComparisonMap[props.calldataDecoded?.paramComp[i]] as ParamComparison,
          value: [props.calldataDecoded?.compValue[i]],
        } as ParamCondition,
      )
    }
  } else if (props.functionName === "scopeAllowFunction") {
    // use ConditionType.WILDCARDED
  }
  console.warn("COND: ", toRaw(condition));
  return condition
})

const decodeData = async () => {
  // if no decoded data, return
  if (Object.keys(props.calldataDecoded).length === 0) return;
  const targetAddress = props.calldataDecoded?.targetAddress;
  targetABIJson.value = [];
  if (!targetAddress || !props.chainId) return;
  isFetchingTargetABI.value = true;
  console.log("Fetch target ABI action", props.chainId, targetAddress);

  try {
    const sourceCode = await fundStore.fetchAddressSourceCode(props.chainId, targetAddress);
    targetABIJson.value = sourceCode?.ABI || [];
    console.debug("fetched ABI targetABIJson", targetABIJson.value);
    isFetchingTargetABI.value = false;
  } catch (error: any) {
    isFetchingTargetABI.value = false;
    console.error("Something went wrong fetching target ABI.", error);
  }
};

// populate proposal data on load
watch(
  () => props.calldataDecoded,
  (newValue) => {
    decodeData();
  },
  { immediate: true },
);

watch(
  () => targetABIJson.value, () => {
    // Update write functions when the ABI changes.
    const writeFunctions = getWriteFunctions(targetABIJson.value);
    abiWriteFunctions.value = writeFunctions;
    console.log(writeFunctions);

    // Condition sighashes of functions that are not in the detected ABI.
    functionAbi.value = writeFunctions?.find(
      (func: FunctionFragment) => func.selector === props.calldataDecoded.functionSig,
    )
  },
  { immediate: true, deep: true },
);
</script>

<style scoped lang="scss">
.section {
  &__title {
    display: flex;
    gap: 15px;
    align-items: center;
    font-size: $text-md;
    font-weight: 700;
    color: $color-white;
  }
}
.fields {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}
</style>
