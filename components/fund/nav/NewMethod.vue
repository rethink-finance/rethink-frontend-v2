<template>
  <v-form ref="form" v-model="formIsValid" class="new_method">
    <div class="new_method__section">
      Position
    </div>
    <div class="new_method__grid">
      <div class="new_method__field">
        <span class="new_method__label">
          Position name<span class="new_method__star">*</span>
        </span>
        <v-text-field
          v-model="navMethod.positionName"
          placeholder="E.g. WETH"
          :rules="rules"
          required
        />
      </div>
      <div class="new_method__field">
        <span class="new_method__label">
          Valuation source<span class="new_method__star">*</span>
        </span>
        <v-text-field
          v-model="navMethod.valuationSource"
          placeholder="E.g. Uniswap ETH/USDC"
          :rules="rules"
          required
        />
      </div>
    </div>

    <div class="new_method__grid">
      <div class="new_method__field">
        <span class="new_method__label">Position type</span>
        <UiSegmented
          :model-value="navMethod.positionType"
          :options="parsedPositionTypeItems"
          @update:model-value="(value: string) => navMethod.positionType = value as PositionType"
        />
      </div>
      <div v-if="valuationTypes.length" class="new_method__field">
        <span class="new_method__label">Valuation type</span>
        <UiSegmented
          :model-value="navMethod.valuationType"
          :options="parsedValuationTypeItems"
          @update:model-value="(value: string) => navMethod.valuationType = value as ValuationType"
        />
      </div>
    </div>

    <div class="new_method__section new_method__section--details">
      Method details
    </div>

    <template v-if="navMethod.positionType === PositionType.Composable">
      <v-expansion-panels v-model="expandedPanels" class="new_method__panels">
        <v-expansion-panel
          v-for="(method, index) in navMethod.details[navMethod.positionType]"
          :key="index"
          eager
        >
          <v-expansion-panel-title static>
            <div class="new_method__panel_title">
              <span>{{ index + 1 }}) Method details</span>
              <span
                class="new_method__status"
                :class="method.isValid ? 'new_method__status--valid' : 'new_method__status--invalid'"
              >
                {{ method.isValid ? "Provided" : "Incomplete" }}
              </span>
              <button
                type="button"
                class="new_method__remove"
                aria-label="Remove method details"
                @click.stop="deleteMethod(index)"
              >
                <Icon icon="material-symbols:delete-outline-rounded" width="1rem" />
              </button>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <FundNavMethodDetails
              v-model="navMethod.details[navMethod.positionType][index]"
              :position-type="navMethod.positionType"
              :valuation-type="navMethod.valuationType"
            />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <FundNavMethodDetails
      v-else
      v-model="navMethod.details[navMethod.positionType][0]"
      :position-type="navMethod.positionType"
      :valuation-type="navMethod.valuationType"
    />

    <div class="new_method__actions">
      <!-- A composable position can be valued by more than one call. -->
      <button
        v-if="navMethod.positionType === PositionType.Composable"
        type="button"
        class="new_method__ghost"
        @click="addMethodDetails"
      >
        Add method details
      </button>
      <span v-else />
      <v-btn
        color="primary"
        :disabled="!formIsValid || !areAllMethodDetailsValid"
        @click="addMethod"
      >
        Add method
      </v-btn>
    </div>

    <div v-if="$slots.buttons" class="new_method__slot">
      <slot name="buttons" />
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useToastStore } from "~/store/toasts/toast.store";
import { defaultInputTypeValue, InputType } from "~/types/enums/input_type";
import {
  PositionType, PositionTypeKeys,
  PositionTypes, PositionTypeToNAVEntryTypeMap,
  PositionTypeToValuationTypesMap,
  PositionTypeValuationTypeDefaultFieldsMap, PositionTypeValuationTypeFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";

const props = defineProps({
  fundAddress: {
    type: String,
    default: "",
  },
  baseTokenAddress: {
    type: String,
    default: "",
  },
});
const emit = defineEmits(["newNavMethodCreated"]);


const toastStore = useToastStore();

const expandedPanels = ref([0]);

// Currently we don't support creating a NFT position, so we exclude it here.
const creatablePositionTypes = PositionTypes.filter(positionType => positionType.key !== PositionType.NFT)
const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[navMethod.value.positionType].map(type => ValuationTypesMap[type]),
);
const defaultFields = computed(() =>
  PositionTypeValuationTypeDefaultFieldsMap[navMethod.value.positionType][navMethod.value.valuationType || "undefined"] || [],
);
const areAllMethodDetailsValid = computed(() =>
  // Return true if all methods are valid, otherwise false.
  !navMethod.value.details[navMethod.value.positionType].some((method: any) => !method.isValid),
);

// Segmented control options
const parsedPositionTypeItems = creatablePositionTypes.map(positionType => {
  return {
    key: positionType.key,
    label: positionType.name,
  };
});

const parsedValuationTypeItems = computed(() =>
  valuationTypes.value.map(valuationType => {
    return {
      key: valuationType.key,
      label: valuationType.name,
    };
  }),
);

const form = ref(null);
const formIsValid = ref(false);

const getNewMethodDetails = (positionType: PositionType, valuationType: ValuationType) => {
  const newDetails: Record<string, any> = {
    isValid: false,
  };
  const fields = PositionTypeValuationTypeFieldsMap[positionType][valuationType || "undefined"] || []

  fields.forEach((field: any) => {
    newDetails[field.key] = defaultInputTypeValue[field.type as InputType];
  });
  return newDetails;
}

const navMethod = ref<INAVMethod>({
  positionName: "",
  valuationSource: "",
  positionType: PositionType.Liquid,
  valuationType: ValuationType.DEXPair,
  details: {
    // Init as PositionType.Liquid & ValuationType.DEXPair
    liquid: [
      getNewMethodDetails(PositionType.Liquid, ValuationType.DEXPair),
    ],
    illiquid: [],
    nft: [],
    composable: [],
  },
  detailsJson: "{}",
});

const resetMethods = () => {
  const tmpNavEntry = {
    positionName: navMethod.value.positionName,
    valuationSource: navMethod.value.valuationSource,
    positionType: navMethod.value.positionType,
    valuationType: navMethod.value.valuationType,
    details: {},
    detailsJson: "{}",
  } as INAVMethod;
  for (const positionTypeKey of PositionTypeKeys) {
    tmpNavEntry.details[positionTypeKey] = [];
  }
  // Init empty details for the selected position type (liquid, illiquid, nft, composable).
  tmpNavEntry.details[navMethod.value.positionType].push(
    getNewMethodDetails(navMethod.value.positionType, navMethod.value.valuationType),
  );

  tmpNavEntry.detailsJson = formatJson(tmpNavEntry.details);

  navMethod.value = tmpNavEntry;
}

const deleteMethod = (index: number) => {
  navMethod.value.details[navMethod.value.positionType].splice(index, 1)
}


const addMethodDetails = () => {
  navMethod.value.details[navMethod.value.positionType].push(
    getNewMethodDetails(navMethod.value.positionType, navMethod.value.valuationType),
  );
}

watch(() => navMethod.value.positionType, (newPositionType) => {
  // Dynamically set valuation type based on the selected position type.
  navMethod.value.valuationType = PositionTypeToValuationTypesMap[newPositionType][0];

  // Reset method details when positionType changes.
  resetMethods();
});
watch(() => navMethod.value.valuationType, () => {
  // Reset method details when valuationType changes.
  resetMethods();
});


/**
 * Handle form validation.
 * Both method fields & method details fields (MethodDetails.vue) have to be valid.
 **/
const rules = [
  formRules.required,
];


const addMethod = () => {
  console.log(navMethod.value);
  // TODO remove isValid from every method details navMethod
  // TODO check validation
  if (!formIsValid.value || !areAllMethodDetailsValid.value)  {
    return toastStore.warningToast(
      "Some form fields are not valid.",
    );
  }

  const newNavMethod = JSON.parse(JSON.stringify(navMethod.value));

  // Do not include the pastNAVUpdateEntryFundAddress in the details, as when we fetch entries
  // they don't include this data and details hash would be broken if we included it.
  newNavMethod.pastNAVUpdateEntryFundAddress = props.fundAddress;

  // Set default fields that are required for each entry.
  // All methods details have this data.
  newNavMethod.details.isPastNAVUpdate = false;
  newNavMethod.details.pastNAVUpdateIndex = 0;
  newNavMethod.details.pastNAVUpdateEntryIndex = 0;
  newNavMethod.details.entryType = PositionTypeToNAVEntryTypeMap[navMethod.value.positionType];
  newNavMethod.details.valuationType = navMethod.value.valuationType;
  newNavMethod.details.description = JSON.stringify({
    positionName: navMethod.value.positionName,
    valuationSource: navMethod.value.valuationSource,
  });

  // TODO add additional check that all methods have the same pastNAVUpdateIndex
  // Iterate over all NAV entry methods.
  // In most cases methods will be only one method, only if the PositionType is Composable, there can be
  // more than 1 method, and we will create a new NAV entry for each of them, with the same position name...
  // - NFT (composable) can have more than 1 method, so take all methods in details.
  // - All other Position Types can only have 1 method, so take the first one (there should only be one).
  for (const method of newNavMethod.details[newNavMethod.positionType]) {
    // Set default data for each entry's method's position & valuation type.
    defaultFields.value.forEach(field => {
      if (!(field.key in method)) {
        method[field.key] = field.value;
      }
    });

    if ("pastNAVUpdateIndex" in method) {
      newNavMethod.details.pastNAVUpdateIndex = method.pastNAVUpdateIndex;
    }

    if ("otcTxHashes" in method) {
      try {
        method.otcTxHashes = method.otcTxHashes.split(",").map(
          // Remove leading and trailing whitespace
          (hash: any) => hash.trim(),
        ).filter(
          // Remove empty strings;
          (hash: any) => hash !== "",
        ) || [];
      } catch (error: any) {
        return toastStore.errorToast("Something went wrong parsing the comma-separated list of TX hashes.")
      }
    }

    // Set other misc dynamic fields related to the current fund, specific for each position & valuation type.
    if (newNavMethod.positionType === PositionType.Liquid && newNavMethod.valuationType === ValuationType.DEXPair) {
      method.nonAssetTokenAddress = props.baseTokenAddress;
    }

    // Remove unwanted properties that we don't need when submitting the proposal.
    delete method.isValid;
    delete method.valuationType;
  }

  // Mark entry as new, so that it will be green in the table.
  newNavMethod.isNew = true;

  // JSONIFY method details:
  newNavMethod.detailsJson = formatJson(newNavMethod.details);
  newNavMethod.detailsHash = ethers.keccak256(ethers.toUtf8Bytes(newNavMethod.detailsJson))
  console.log("New Method JSON: ", newNavMethod.detailsJson);

  toastStore.addToast("New NAV method was created.")
  emit("newNavMethodCreated", newNavMethod)
  resetMethods();
}
</script>

<style scoped lang="scss">
/**
 * The define-method form in the create flow's field language: mono
 * uppercase labels, a two-column rhythm, a section eyebrow between the
 * position and its valuation details.
 */
.new_method {
  display: flex;
  flex-direction: column;

  &__section {
    margin-bottom: 0.875rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-white;

    &--details {
      margin-top: 1.75rem;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem 1.25rem;

    @include md {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    & + & {
      margin-top: 1rem;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__star {
    margin-left: 0.25em;
    color: $color-cyan;
  }

  &__panels {
    :deep(.v-expansion-panel-title) {
      min-height: 0;
      padding: 0.75rem 1rem;
    }
    :deep(.v-expansion-panel-text__wrapper) {
      padding: 0 1rem 1rem;
    }
  }

  &__panel_title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__status {
    margin-left: auto;

    &--valid {
      color: $color-yield;
    }
    &--invalid {
      color: $color-warn;
    }
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      color: $color-neg;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1.5rem;
  }

  &__ghost {
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-sans;
    font-size: 13px;
    font-weight: 600;
    color: $color-text-irrelevant;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }

  &__slot {
    display: flex;
    justify-content: space-around;
    margin-top: 0.5rem;
  }

  @media (prefers-reduced-motion: reduce) {
    &__ghost {
      transition: none;
    }
  }
}
</style>
