<template>
  <v-text-field
    v-model="localValue"
    :placeholder="getPlaceholderForType"
    :disabled="disabled"
    variant="outlined"
    density="compact"
    hide-details="auto"
  />
</template>

<script setup lang="ts">
import { ethers, type ParamType } from "ethers";
import {
  formatParamValue,
  getNativeType,
} from "~/composables/zodiac-roles/conditions";
import { ParamNativeType } from "~/types/enums/zodiac-roles";
import type { FlattenedParamType } from "~/types/zodiac-roles/role";
const emit = defineEmits(["update:modelValue"]);

const props = defineProps({
  modelValue: {
    type: Array as () => string[],
    default: () => [],
  },
  param: {
    type: Object as PropType<FlattenedParamType>,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const localValue = ref("");
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const tryAbiEncode = (value: string) => {
  if (!props.param) return value

  try {
    return abiCoder.encode([props.param], [formatParamValue(props.param, value)])
  } catch (err: any) {
    console.error("failed abi encode", props.param, "value", value, "err", err);
    return null
  }
}

const tryAbiDecode = (value?: string) => {
  if (!value) return value
  if (!props.param) return value
  console.debug("tryAbi decode", props.param, value)
  try {
    const paramTypeString = props.param.format("full")
    const nativeType = getNativeType(props.param)
    const decoded = abiCoder.decode([paramTypeString], value)[0]
    return nativeType === ParamNativeType.ARRAY || nativeType === ParamNativeType.TUPLE
      ? JSON.stringify(decoded)
      : decoded.toString()
  } catch (err) {
    // TODO handle errors, if bad address checksum and so on...
    console.error("Error decoding value", err, { value })
    return null
  }
}

const getPlaceholderForType = computed(() => {
  const nativeType = getNativeType(props.param)
  return PlaceholderPerType[nativeType]
});

const PlaceholderPerType: Record<ParamNativeType, string> = {
  [ParamNativeType.ARRAY]: "[element 0, value 1, ...]",
  [ParamNativeType.TUPLE]: "[field 0, field 1, ...]",
  [ParamNativeType.BOOLEAN]: "true",
  [ParamNativeType.INT]: "-235000000",
  [ParamNativeType.UINT]: "235000000",
  [ParamNativeType.ADDRESS]: "0xABF...123",
  [ParamNativeType.STRING]: "Enter a string",
  [ParamNativeType.BYTES]: "0x...",
  [ParamNativeType.BYTES_FIXED]: "0x...",
  [ParamNativeType.UNSUPPORTED]: "0x...",
}

// Watch for Local Changes & Emit Encoded Value
watch(
  localValue,
  (newValue) => {
    if (newValue !== props.modelValue[0]) {
      console.log("    [2] watch newValue", toRaw(newValue))
      const encoded = [tryAbiEncode(newValue) || ""];
      // console.log("encoded value: ", encoded);
      console.log("encoded value to emit: ", encoded);
      emit("update:modelValue", encoded);
    }
  },
);

// Watch for ModelValue Changes & Sync Local Value
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue[0] !== localValue.value) {
      localValue.value = tryAbiDecode(newValue[0] || "");
      console.log("  condition input value changed decoded value", localValue.value);
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
</style>
