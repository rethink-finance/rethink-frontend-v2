<template>
  <div class="onboarding_info_fields">
    <v-col
      v-for="(field, index) in fields"
      :key="index"
      :cols="field?.cols ?? 12"
      class="pb-2"
    >
      <div v-if="field.isToggleable" class="toggleable_group">
        <div class="toggleable_group__toggle">
          <v-switch
            v-model="field.isToggleOn"
            color="primary"
            hide-details
            :disabled="isFundInitialized && step < 6"
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
              :is-disabled="!field.isToggleOn || (isFundInitialized && step < 6)"
            />
          </v-col>
        </div>
      </div>
      <div v-else>
        <UiField
          v-model="field.value"
          :field="field"
          :is-disabled="isFundInitialized && step < 6"
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
