<template>
  <v-text-field
    v-model="internalValueAsString"
    class="input_number"
    type="number"
    min="0"
    hide-spin-buttons
    :placeholder="placeholder"
    :hide-details="hideDetails"
    @input="$emit('input', $event)"
  />
</template>

<script lang="ts" setup>
const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: "",
  },
  placeholder: {
    type: String,
    default: "0",
  },
  hideDetails: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "input"]);

// Always store as a string
const internalValue = ref(props.modelValue.toString());

// Computed property to convert internalValue to a string for display
const internalValueAsString = computed({
  get: () => internalValue.value,
  set: (newValue) => {
    if (newValue) {
      newValue = newValue.replace("-", "")
    }
    if (newValue === "") {
      // Handle empty input by converting it to empty string.
      internalValue.value = "";
    } else {
      // Convert the string input to a number
      const parsedValue = parseFloat(newValue);
      if (!isNaN(parsedValue)) {
        internalValue.value = newValue.toString();
      }
    }
    emit("update:modelValue", internalValue.value);
  },
});

// Watch for changes in the props and update internalValue
watch(
  () => props.modelValue,
  (newValue) => {
    internalValue.value = newValue.toString();
  },
);
</script>

<style lang="scss" scoped>
.input_number {
  :deep(input) {
    font-size: $text-sm;
  }
  :deep(input) {
    text-align: right !important;
  }
  :deep(.v-input) {
      font-size: $text-sm;
      line-height: 1;
  }
  :deep(.v-field) {
    border-radius: 0;
    border: none;
  }
}
</style>
