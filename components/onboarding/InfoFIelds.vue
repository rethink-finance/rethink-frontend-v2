<template>
  <div class="onboarding_info_fields">
    <v-col
      v-for="(field, index) in fields"
      :key="index"
      :cols="field?.cols ?? 12"
      class="pb-2"
    >
      <UiFieldsGroup
        v-if="field.fields"
        v-model:is-toggle-on="field.isToggleOn"
        :field-group="field"
        :is-group-disabled="isStepDisabled"
      >
        <template #default="{ subField }">
          <UiField
            v-model="subField.value"
            :field="subField"
            :is-disabled="!field.isToggleOn || isStepDisabled"
            :chain-id="chainId"
          />
        </template>
      </UiFieldsGroup>

      <div v-else class="field_container">
        <UiField
          v-model="field.value"
          v-model:is-custom-value-toggle-on="field.isCustomValueToggleOn"
          v-model:default-value="field.defaultValue"
          :field="field"
          :is-disabled="isStepDisabled"
          :custom-error-message="getCustomFieldErrorMessage(field)"
          :show-default-value-info="!isFundInitialized"
          :chain-id="chainId"
        />

        <div
          v-if="field.key === 'baseToken'"
          class="base_token_data"
        >
          <UiField
            v-model:model-value="baseTokenSymbol"
            class="base_token_data__input"
            :field="baseTokenSymbolField"
            :is-disabled="true"
            :chain-id="chainId"
          />
          <UiField
            v-model:model-value="baseTokenDecimals"
            class="base_token_data__input"
            :field="baseTokenDecimalsField"
            :is-disabled="true"
            :chain-id="chainId"
          />
        </div>
        <UiDetailsButton
          v-if="field.isFieldByUser"
          small
          class="field_delete"
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
import debounce from "lodash.debounce";
import { fetchBaseTokenDetails } from "~/store/create-fund/actions/fetchFundInitCache.action";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import type { ChainId } from "~/store/web3/networksMap";
import { baseTokenDecimalsField, baseTokenSymbolField } from "~/types/enums/fund_setting_proposal";
import type { IField } from "~/types/enums/input_type";

const createFundStore = useCreateFundStore();

const { fundChainId, fundChainName } = storeToRefs(createFundStore);
const emit = defineEmits(["deleteRow"]);

const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
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

const baseTokenDecimals = ref<string>("/");
const baseTokenSymbol = ref<string>("/");
const baseTokenFetchError = ref<string>("");

const isStepDisabled = computed(() =>
  props.isFundInitialized && props.step > 1 && props.step < 7,
)

const getCustomFieldErrorMessage = (field: IField): string => {
  // Show base token error message if we tried fetching it and there was an error.
  if (field.key === "baseToken") {
    return baseTokenFetchError.value || "";
  }
  return "";
}

watch(
  () => props.fields.find((field) => field.key === "baseToken")?.value,
  (newBaseToken) => handleBaseTokenChange(newBaseToken as any),
);

// Debounced watcher callback, do not fetch token data immediately, but wait 300ms.
const handleBaseTokenChange = debounce(async (newBaseToken: string | null) => {
  baseTokenFetchError.value = "";

  // If the base token changes, try fetching its symbol and decimals to validate
  // if it's a correct ERC20 token address to prevent mistakes.
  if (newBaseToken) {
    console.debug("Base token changed", fundChainId?.value, newBaseToken);
    try {
      const [decimals, symbol] = await fetchBaseTokenDetails(fundChainId.value, newBaseToken);
      baseTokenDecimals.value = decimals;
      baseTokenSymbol.value = symbol;
    } catch (error: any) {
      console.error("Failed fetching base token symbol & decimals", error);
      baseTokenFetchError.value = `Are you sure this is a valid ERC20 token address on ${fundChainName?.value}? Failed fetching its symbol and decimals.`;
      baseTokenSymbol.value = "/";
      baseTokenDecimals.value = "/";
    }
  } else {
    baseTokenSymbol.value = "/";
    baseTokenDecimals.value = "/";
  }
}, 300); // 300ms delay

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
.field_delete{
  margin-top: 30px;
}
.base_token_data {
  display: flex;
  gap: 2rem;
}
</style>
