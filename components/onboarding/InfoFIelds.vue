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
        <UiField
          v-if="field.isCustomValueToggleOn"
          v-model="field.value"
          :field="field"
          :is-disabled="!field.isCustomValueToggleOn || isStepDisabled"
        >
          <template #field-actions>
            <div class="toggleable_group__toggle">
              <v-switch
                v-model="field.isCustomValueToggleOn"
                color="primary"
                hide-details
                :disabled="isStepDisabled"
              />
            </div>
          </template>
        </UiField>
        <div v-else class="default-value">
          <UiField
            v-model="field.defaultValue"
            :field="field"
            :is-disabled="isStepDisabled"
            :show-default-value-info="isFundInitialized ? false : true"
          >
            <template #field-actions>
              <div class="toggleable_group__toggle">
                <v-switch
                  v-model="field.isCustomValueToggleOn"
                  color="primary"
                  hide-details
                  :disabled="isStepDisabled"
                />
              </div>
            </template>
          </UiField>
        </div>

      </div>
      <div v-else class="field_container">
        <UiField
          v-model="field.value"
          :field="field"
          :is-disabled="isStepDisabled"
        />

        <UiField
          v-if="field.key === 'baseToken'"
          v-model:model-value="baseTokenSymbol"
          :field="baseTokenSymbolField"
          :is-preview="true"
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
import { baseTokenSymbolField } from "~/types/enums/fund_setting_proposal";
import { fetchBaseTokenDetails } from "~/store/create-fund/actions/fetchFundInitCache.action";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
const createFundStore = useCreateFundStore();

const { fundChainId } = storeToRefs(createFundStore);
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

const baseTokenSymbol = ref<string>("/");

const isStepDisabled = computed(() =>
  props.isFundInitialized && props.step > 1 && props.step < 7,
)

// TODO add watcher after baseToken changes, fetch ERC20 token symbol using
// function fetchBaseTokenDetails that is already built and update ref baseTokenSymbol
// Watcher for changes in `baseToken`
// watch(
//   () => props.fields.find((field) => field.key === "baseToken")?.value,
//   (newBaseToken) => {
//     if (newBaseToken) {
//       // TODO try except
//       fetchBaseTokenDetails(fundChainId.value, newBaseToken);
//       console.log("Base token changed", newBaseToken);
//     } else {
//       baseTokenSymbol.value = "/";
//     }
//   },
// );

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
