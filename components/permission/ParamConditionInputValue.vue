<template>
  <v-text-field
    v-model="localValue"
    :placeholder="getPlaceholderForType"
    :disabled="disabled"
    :rules="rules"
    :error-messages="errorMessages"
    variant="outlined"
    density="compact"
    hide-details="auto"
  />
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import {
  formatParamValue,
  getNativeType,
} from "~/composables/zodiac-roles/conditions";
import { ParamNativeType } from "~/types/enums/zodiac-roles";
import type { FlattenedParamType } from "~/types/zodiac-roles/role";
const emit = defineEmits(["update:modelValue"]);

const props = defineProps({
  modelValue: {
    type: String,
    default: undefined,
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
const rules = [
  formRules.required,
];
const errorMessages = ref<string[]>([]);

const tryAbiEncode = (value: string) => {
  errorMessages.value = [];
  if (!props.param) return value

  try {
    return abiCoder.encode([props.param], [formatParamValue(props.param, value)])
  } catch (err: any) {
    console.error("failed abi encode", props.param, "value", value, "err", err);
    console.error(err);
    // TODO show input error in the form to let user know it fails!
    errorMessages.value = [err?.message || ""]
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
    console.log("tryAbi decode 2 param", props.param,
      "val:", toRaw(value),
      "paramTypeString:", paramTypeString,
      "nativeType", nativeType,
    )
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
    if (newValue !== props.modelValue) {
      console.log("    [2] watch newValue", toRaw(newValue), toRaw(props.modelValue))
      const encoded = tryAbiEncode(newValue) || "";
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
    if (newValue !== localValue.value) {
      console.log("  condition input value changed decoded value OLD", localValue.value);
      localValue.value = tryAbiDecode(newValue || "");
      console.log("  condition input value changed decoded value NEW", localValue.value);
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
</style>
