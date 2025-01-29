<template>
  <div class="target_function_params">
    <div v-if="func?.inputs?.length">
      <div
        v-for="(funcInputParam, index) in func.inputs"
      >
        <div class="permissions__function">
          <div class="target_function_params__title">
            <Icon icon="tabler:point-filled" />
            <div>
              {{ funcInputParam.name }}
            </div>
            <div class="permissions__function_params">
              ({{ funcInputParam.type }})
            </div>
          </div>
          <PermissionParamConditionInput
            :index="index"
            :param="funcInputParam"
            :condition="funcConditions?.params?.find((param) => param?.index === index)"
            :disabled="true"
          />
        </div>
      </div>
    </div>
    <!-- TODO show the condition even though we don't have the ABI -->
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { FunctionFragment } from "ethers";
import type { FunctionCondition } from "~/types/zodiac-roles/role";

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
    default: undefined,
  },
  funcConditions: {
    type: Object as PropType<FunctionCondition>,
    default: undefined,
  },
  sighash: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// TODO localCondition and emit to parent, test when you edit field in child
// Watch for changes in localCondition and emit updates
// watch(
//   localCondition,
//   (newLocalFuncConditions) => {
//     if (JSON.stringify(newLocalFuncConditions) !== JSON.stringify(props.condition)) {
//       console.log("    [2] watch localCondition", toRaw(newLocalFuncConditions))
//       emit("update:condition", newLocalFuncConditions);
//     }
//   },
//   { deep: true },
// );
//
// // Update localCondition when `props.condition` changes (but don't emit).
// watch(
//   () => props.condition,
//   (newCondition) => {
//     // Update without emitting
//     if (JSON.stringify(newCondition) !== JSON.stringify(localCondition.value)) {
//       console.log("    [2] watch props.condition", toRaw(newCondition))
//       // TODO check boolean when editing if they update correctly, convert bool to string
//       localCondition.value = { ...newCondition };
//     }
//   },
//   { deep: true, immediate: true },
// );
</script>

<style lang="scss" scoped>
.target_function_params {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 2.75rem;
  }
}
.permissions__function {
  align-items: flex-start;
}
</style>
