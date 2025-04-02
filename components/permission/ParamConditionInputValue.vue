<template>
  <v-text-field
    v-model="localValue"
    :placeholder="getPlaceholderForType"
    :disabled="disabled"
    :rules="rules"
    :error-messages="errorMessages"
    :hint="localValueLabel"
    :persistent-hint="!!localValueLabel"
    variant="outlined"
    density="compact"
    hide-details="auto"
  />
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import debounce from "lodash.debounce";
import {
  formatParamValue,
  getNativeType,
} from "~/composables/zodiac-roles/conditions";
import { useFundStore } from "~/store/fund/fund.store";
import { useFundsStore } from "~/store/funds/funds.store";
import type { ChainId } from "~/types/enums/chain_id";
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
const fundsStore = useFundsStore();
const fundStore = useFundStore();
const chainId = inject<ChainId>("chainId");

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

const localValueLabel = ref<string | undefined>()

// Watch for Local Changes & Emit Encoded Value
watch(
  localValue,
  (newValue) => {
    if (newValue !== props.modelValue) {
      const encoded = tryAbiEncode(newValue) || "";
      emit("update:modelValue", encoded);
    }
  },
);

// Debounced label loader
const setAddressLabel = debounce(async (value: string) => {
  try {
    console.log("get address label");
    localValueLabel.value = await fundStore.getAddressLabel(value, chainId)
  } catch (err: any) {
    console.error("Error getAddressLabel", value, err)
  }
}, 250) // 250ms debounce

// Watch for ModelValue Changes & Sync Local Value & fetch label
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== localValue.value) {
      localValue.value = tryAbiDecode(newValue || "");
      setAddressLabel(localValue.value);
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
::v-deep(.v-input__details) {
  opacity: 1;
  font-weight: 700;
  position: relative;
  top: -0.5rem;

  .v-messages {
    opacity: 1;
  }
}
</style>
