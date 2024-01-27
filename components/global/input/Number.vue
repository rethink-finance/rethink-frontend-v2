<template>
  <v-text-field
    v-model.number="internalValue"
    class="custom-text-field"
    type="number"
    min="0"
  />
</template>

<script lang="ts" setup>
const props = defineProps({
  modelValue: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["update:modelValue"]);

// Always store as a string
const internalValue = ref(props.modelValue);

watch(internalValue, (newValue) => {
  if (newValue == null || isNaN(newValue) || newValue < 0) {
    internalValue.value = 0;
  } else {
    emit("update:modelValue", newValue);
  }
});

watch(() => props.modelValue, (newValue) => {
  if (newValue == null || isNaN(newValue) || newValue < 0) {
    internalValue.value = 0;
  } else {
    internalValue.value = newValue;
  }
});
</script>

<style lang="scss" scoped>
.custom-text-field {
  ::v-deep(input) {
    text-align: right !important;
  }
}
</style>
