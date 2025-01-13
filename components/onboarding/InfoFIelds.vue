<template>
  <div class="onboarding_info_fields">
    <v-col
      v-for="(field, index) in fields"
      :key="index"
      :cols="field?.cols ?? 12"
      class="pb-2"
    >
      <div v-if="field.fields" class="toggleable_group">
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
            >
              <template #field-actions>
                <div
                  v-if="subFieldIndex === 0"
                  class="toggleable_group__toggle"
                >
                  <v-switch
                    v-model="field.isToggleOn"
                    color="primary"
                    hide-details
                    :disabled="isStepDisabled"
                  />
                </div>
              </template>

            </UiField>
          </v-col>
        </div>
      </div>
      <!-- some fields can have toggleable default value -->
      <div v-else-if="field.defaultValue">
        <div class="toggleable_group__toggle">
          <v-switch
            v-model="field.isCustomValueToggleOn"
            color="primary"
            hide-details
            :disabled="isStepDisabled"
          />
        </div>
        <UiField
          v-if="field.isCustomValueToggleOn"
          v-model="field.value"
          :field="field"
          :is-disabled="!field.isCustomValueToggleOn || isStepDisabled"
        />
        <div v-else class="default-value">
          <UiField
            v-model="field.defaultValue"
            :field="field"
            :show-defailt-value-info="true"
          />
        </div>

      </div>
      <div v-else class="field_container">
        <UiField
          v-model="field.value"
          :field="field"
          :is-disabled="isStepDisabled"
        />
        <UiDetailsButton
          v-if="field.isFieldByUser"
          small
          style="margin-top: 30px;"
          @click.stop="deleteRow(field)"
        >
          <v-icon
            icon="mdi-delete"
            color="error"
          />
        </UiDetailsButton>
      </div>
    </v-col>
  </div>
</template>

<script setup lang="ts">
import type { IField } from "~/types/enums/input_type";

const emit = defineEmits(["deleteRow"]);

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

const deleteRow = (field: IField) => {
  emit("deleteRow", field);
}

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
  border: 1px solid $color-bg-transparent;


  &__toggle {
    display: flex;
    justify-content: flex-end;
    margin-left: auto;
  }
}

.field_container{
  display: flex;
  justify-content: space-between;
  gap: 10px;

  :deep(.field){
    width: 100%;
  }
}
</style>
