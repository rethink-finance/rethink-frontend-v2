<template>
  <div class="execution_options">
    <div>
      <v-checkbox-btn
        v-model="allowSend"
        :disabled="disabled"
        label="Allow Sending Ether"
        @change="emitChange"
      />
    </div>
    <div>
      <v-checkbox-btn
        v-model="allowDelegateCall"
        :disabled="disabled"
        label="Allow Delegate Call"
        @change="emitChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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
watch(() => props.modelValue,
  (newValue) => {
    const flags = enumToFlags(newValue);
    allowSend.value = flags.allowSend;
    allowDelegateCall.value = flags.allowDelegateCall;
  },
  { immediate: true },
);

// Emit updated value when checkboxes change
const emitChange = () => {
  emit("update:modelValue", flagsToEnum.value);
};
</script>

<style lang="scss" scoped>
.execution_options {
  display: flex;
  flex-direction: row;
  gap: 1rem;
}
</style>
