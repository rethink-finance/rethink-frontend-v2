<template>
  <div class="field_group">
    <v-col
      class="field_group__toggle"
    >
      <v-switch
        v-model="toggleValue"
        color="primary"
        hide-details
        :disabled="isGroupDisabled"
        :label="fieldGroup.groupName"
      />
      <v-tooltip v-if="fieldGroup?.tooltip" location="top">
        <template #activator="{ props }">
          <Icon
            v-bind="props"
            icon="octicon:question-16"
            width="1.25rem"
            class="field_group__tooltip"
          />
        </template>
        {{ fieldGroup.tooltip }}
      </v-tooltip>
    </v-col>

    <div class="field_group__fields">
      <v-col
        v-for="(subField, subFieldIndex) in fieldGroup.fields"
        :key="subFieldIndex"
        :cols="subField?.cols ?? 6"
      >

        <!-- TODO: here we should have the UiField component, but fund settings don't use value from the field
            we need to refactor fund settings page to use value from the field, that's why we are using slot here (for now)
        -->
        <!-- <UiField
          v-model="subField.value"
          :field="subField"
          :is-disabled="!toggleValue || isGroupDisabled"
        /> -->

        <slot :sub-field="subField" />
      </v-col>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IField } from "~/types/enums/input_type";

const emit = defineEmits(["update:isToggleOn"]);

// Props
const props = defineProps({
  isToggleOn: {
    type: Boolean,
    default: false,
  },
  fieldGroup: {
    type: Object as PropType<IField>,
    default: () => ({}),
  },
  isGroupDisabled: {
    type: Boolean,
    default: false,
  },
})

const toggleValue = computed({
  get: () => props.isToggleOn,
  set: (value: boolean) => {
    emit("update:isToggleOn", value);
  },
});
</script>

<style scoped lang="scss">
.field_group {
  display: flex;
  flex-direction: column;
  border: 1px solid $color-bg-transparent;

  &__toggle {
    display: flex;
    gap: 10px;
    align-items: center;
    padding-top: 0;
    padding-bottom: 0;
  }
  &__fields {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }
  &__tooltip{
    cursor: pointer;
    color: $color-text-irrelevant;
    transition: color 0.3s ease;

    &:hover {
      color: $color-primary;
    }
    &:focus {
      outline: none;
    }
  }
}
</style>
