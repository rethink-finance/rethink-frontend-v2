<template>
  <div class="onboarding_info_fields">
    <v-col
      v-for="(field, index) in fields"
      :key="index"
      :cols="field?.cols ?? 12"
      class="pb-2"
    >
      <div v-if="field.fields" class="toggleable_group">
        <div class="toggleable_group__toggle">
          <v-switch
            v-model="field.isToggleOn"
            color="primary"
            hide-details
            :disabled="isStepDisabled"
          />
        </div>

        <div class="fields">
          <v-col
            v-for="(subField, subFieldIndex) in field.fields"
            :key="subFieldIndex"
            :cols="subField?.cols ?? 6"
          >
            <UiField
              v-model="subField.value"
              :field="subField"
              :is-disabled="!field.isToggleOn || isStepDisabled"
            />
          </v-col>
        </div>
      </div>
      <!-- some fields can have toggleable default value -->
      <div v-else-if="field.defaultValue">
        <div class="toggleable_group__toggle">
          <v-switch
            v-model="field.isCustomValue"
            color="primary"
            hide-details
            :disabled="isStepDisabled"
          />
        </div>
        <UiField
          v-if="field.isCustomValue"
          v-model="field.value"
          :field="field"
          :is-disabled="!field.isCustomValue || isStepDisabled"
        />
        <div v-else class="default-value">
          <UiField
            v-model="field.defaultValue"
            :field="field"
            :is-disabled="true"
          />
          <v-tooltip activator="parent" location="top">
            Default value (toggle to edit)
          </v-tooltip>
        </div>

      </div>
      <div v-else>
        <UiField
          v-model="field.value"
          :field="field"
          :is-disabled="isStepDisabled"
        />
      </div>
    </v-col>
  </div>
</template>

<script setup lang="ts">
import type { IField } from "~/types/enums/input_type";

const props = defineProps({
  fields: {
    type: Array as () => IField[],
    default: () => [],
  },
  isFundInitialized: {
    type: Boolean,
    required: true,
  },
  step: {
    type: Number,
    required: true,
  },
});

const isStepDisabled = computed(() =>
  props.isFundInitialized && props.step > 1 && props.step < 7,
)
</script>

<style scoped lang="scss">
.onboarding_info_fields {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}
.toggleable_group {
  display: flex;
  flex-direction: column;

  &__toggle {
    display: flex;
    justify-content: flex-end;
    margin-left: auto;
  }
}
</style>
