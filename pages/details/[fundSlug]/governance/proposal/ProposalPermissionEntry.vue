<template>
  <!--  TODO remove this -->
  <!--  <div class="permissions__json">-->
  <!--    {{ calldataDecoded }}-->
  <!--  </div>-->
  <!--  <div class="permissions__json">-->
  <!--    {{ functionAbi }}-->
  <!--  </div>-->
  <div v-if="functionName == 'scopeTarget'">
    Restricted access to target
    <strong>{{ calldataDecoded?.targetAddress }}</strong>
    <template v-if="targetContractLabel">
      ({{ targetContractLabel }})
    </template>.
    Only scoped functions are now allowed.
  </div>
  <p v-else-if="functionName === 'allowTarget'">
    Role was
    <span v-if="calldataDecoded?.options == 1" class="text-success">
      granted <strong>call</strong> access
    </span>
    <span v-else-if="calldataDecoded?.options == 2" class="text-success">
      granted <strong>delegatecall</strong> access
    </span>
    <strong v-else class="text-error">
      denied access
    </strong>
    to contract <strong>{{ calldataDecoded?.targetAddress }}</strong>
    <template v-if="targetContractLabel">
      ({{ targetContractLabel }})
    </template>.
  </p>
  <div v-else-if="functionName === 'assignRoles' || functionName === 'grantRoles'">
    Edit roles for <strong>{{ calldataDecoded?.module }}</strong>:
    <div class="ms-2">
      <div
        v-for="i in calldataDecoded?.memberOf?.length || 0"
        :key="i"
      >
        <span
          v-if="calldataDecoded?.memberOf[i - 1]"
          class="d-flex align-center"
        >
          <Icon
            icon="octicon:check-circle-16"
            height="1.2rem"
            width="1.2rem"
            class="text-success"
          />
          Added Role {{ calldataDecoded?._roles[i - 1] }}
        </span>
        <span v-else>
          <Icon
            icon="octicon:x-circle-16"
            class="text-error"
            height="1.2rem"
            width="1.2rem"
          />
          Removed Role {{ calldataDecoded?._roles[i - 1] }}
        </span>
      </div>
    </div>
  </div>
  <div v-else-if="functionAbi?.selector" class="permissions__list flex-grow-1">
    <PermissionTargetFunction
      :func="functionAbi as FunctionFragment"
      disabled
      :func-conditions="getFuncCondition(functionAbi.selector)"
      only-show-condition-params
    />
  </div>
  <div v-else>
    {{ formatCalldata(calldataDecoded) }}
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
import { formatCalldata } from "~/composables/formatters";
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
const targetContractLabel = ref<string | undefined>(undefined);

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
  // TODO move this logic to some other function and write tests!
  // TODO handle all cases
  // TODO separate UI for allowMember, allowTarget
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
      if (!props.calldataDecoded?.isParamScoped[i]) {
        // Ignore parameters that are not scoped.
        // This parameter is not being restricted by a condition, any value allowed.
        continue;
      }
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
  targetContractLabel.value = undefined;

  // if no decoded data, return
  if (Object.keys(props.calldataDecoded).length === 0) return;
  const targetAddress = props.calldataDecoded?.targetAddress;
  targetABIJson.value = [];
  if (!targetAddress || !props.chainId) return;
  isFetchingTargetABI.value = true;
  // console.log("Fetch target ABI action", props.chainId, targetAddress);

  try {
    const sourceCode = await fundStore.fetchAddressSourceCode(props.chainId, targetAddress);
    targetABIJson.value = sourceCode?.ABI || [];
    // console.debug("fetched ABI targetABIJson", targetABIJson.value);
    isFetchingTargetABI.value = false;
  } catch (error: any) {
    isFetchingTargetABI.value = false;
    console.error("Something went wrong fetching target ABI.", error);
  }

  fundStore.getAddressLabel(targetAddress, props.chainId).then(
    (label: string | undefined) => targetContractLabel.value = label,
  )
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
