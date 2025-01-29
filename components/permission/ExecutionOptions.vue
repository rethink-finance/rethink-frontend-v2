<template>
  <div class="execution_options">
    <v-checkbox-btn
      v-model="allowSend"
      :disabled="disabled"
      label="Allow sending ether"
      @change="emitChange"
    />

    <v-checkbox-btn
      v-model="allowDelegateCall"
      :disabled="disabled"
      label="Allow delegate call"
      @change="emitChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits, ref, watch } from "vue";
import type { PropType } from "vue";
import { ExecutionOption } from "~/types/enums/zodiac-roles";

// Props with `modelValue` instead of `value`
const props = defineProps({
  modelValue: {
    type: Number as PropType<ExecutionOption>,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Emits with Vue 3 `update:modelValue`
const emit = defineEmits(["update:modelValue"]);

// Reactive states for checkboxes
const allowSend = ref(false);
const allowDelegateCall = ref(false);

// Converts ExecutionOption enum to checkbox states
const enumToFlags = (value: ExecutionOption) => ({
  allowSend: value === ExecutionOption.BOTH || value === ExecutionOption.SEND,
  allowDelegateCall: value === ExecutionOption.BOTH || value === ExecutionOption.DELEGATE_CALL,
});

// Converts checkbox states back to ExecutionOption enum
const flagsToEnum = computed(() => {
  if (allowSend.value && allowDelegateCall.value) return ExecutionOption.BOTH;
  if (allowSend.value) return ExecutionOption.SEND;
  if (allowDelegateCall.value) return ExecutionOption.DELEGATE_CALL;
  return ExecutionOption.NONE;
});

// Update local state when `modelValue` changes
watch(() => props.modelValue, (newValue) => {
  const flags = enumToFlags(newValue);
  allowSend.value = flags.allowSend;
  allowDelegateCall.value = flags.allowDelegateCall;
}, { immediate: true });

// Emit updated value when checkboxes change
const emitChange = () => {
  emit("update:modelValue", flagsToEnum.value);
};
</script>

<style lang="scss" scoped>
.execution_options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
