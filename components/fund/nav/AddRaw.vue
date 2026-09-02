<template>
  <UiConfirmDialog
    :model-value="modelValue"
    eyebrow="NAV methods"
    title="Import raw methods"
    max-width="760px"
    @update:model-value="updateModelValue"
  >
    <FundNavRawMethodsForm
      :methods="methods"
      @added-methods="onAdded"
    />
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import type INAVMethod from "~/types/nav_method";

/**
 * The raw-methods form in a dialog of its own, for pages that open it from
 * a button. The form carries its Load action; this closes once it has run.
 */
const emits = defineEmits(["update:modelValue", "added-methods"]);

defineProps({
  modelValue: Boolean,
  methods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
});

const updateModelValue = (value: boolean) => {
  emits("update:modelValue", value);
};

const onAdded = (entries: INAVMethod[]) => {
  emits("added-methods", entries);
  emits("update:modelValue", false);
};
</script>
