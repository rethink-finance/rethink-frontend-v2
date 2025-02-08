<template>
  <div class="target_function_params">
    <div
      v-if="func?.inputs?.length"
      class="target_function_params__inputs"
    >
      <!-- TODO TEST flattened inputs -->
      <!--      <pre class="permissions__json">{{ JSON.stringify(flattenedInputs, null, 2) }}</pre>-->
      <pre
        v-if="showRaw"
        class="permissions__json"
      >{{ JSON.stringify(funcConditions?.params, null, 2) }}</pre>
      <template v-else>
        <div
          v-for="(funcInputParam, index) in flattenedInputs"
          :key="index"
        >
          <div class="permissions__function">
            <div class="target_function_params__title">
              <Icon icon="tabler:point-filled" />
              <div>
                [{{ index }}]
                <span v-if="funcInputParam.parentName">
                  {{ funcInputParam.parentName }}
                </span>
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
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import { type FunctionFragment, ParamType } from "ethers";
import { useVModel } from "@vueuse/core";
import cloneDeep from "lodash.clonedeep";
import type { FlattenedParamType, FunctionCondition } from "~/types/zodiac-roles/role";

const emit = defineEmits(["update:funcConditions"]);

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
  showRaw: {
    type: Boolean,
    default: false,
  },
});

// const flattenedInputs = ref<FlattenedParamType[]>([]);

const flattenedInputs = computed(() => {
  let indexCounter = 0;
  const flatInputs: FlattenedParamType[] = [];

  function processInputs(
    inputs?: ParamType[],
    parentIndex: number | null = null,
    parentName: string | null = null,
  ) {
    if (!inputs) return;

    for (const input of inputs) {
      if (input.isTuple() && input.components) {
        processInputs(
          input?.components as FlattenedParamType[],
          indexCounter,
          input.name,
        );
      } else {
        // Properly instantiate ParamType to retain methods
        const param = ParamType.from(input);

        // Create a new FlattenedParamType instance without breaking prototype methods
        const wrappedParam: FlattenedParamType = Object.create(param);
        wrappedParam.index = indexCounter;
        wrappedParam.parentIndex = parentIndex;
        wrappedParam.parentName = parentName;

        flatInputs.push(wrappedParam);
        indexCounter++;
      }
    }
  }

  processInputs(props.func?.inputs as FlattenedParamType[]);
  return flatInputs;
});

const localCondition = useVModel(props, "funcConditions", emit, {
  clone: cloneDeep, // Deep copy to avoid prop mutation
  passive: true,    // Prevents excessive reactivity updates
  deep: true,        // Ensures Vue watches nested changes
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
  overflow: hidden;

  &__inputs {
    overflow: auto;
    @include customScrollbar(0);
  }
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
