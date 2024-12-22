<template>
  <div class="main_card">
    <v-form ref="form" v-model="formIsValid">
      <v-row>
        <v-col>
          <strong>Define Position Method</strong>
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          sm="6"
        >
          <v-label class="label_required mb-2">
            Position Name
          </v-label>
          <v-text-field
            v-model="navMethod.positionName"
            placeholder="E.g. WETH"
            :rules="rules"
            required
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-label class="label_required mb-2">
            Valuation Source
          </v-label>
          <v-text-field
            v-model="navMethod.valuationSource"
            placeholder="E.g. Uniswap ETH/USDC"
            :rules="rules"
            required
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col
          cols="12"
          sm="6"
        >
          <v-label class="mb-2">
            Position Type
          </v-label>
          <div class="toggle_buttons">
            <v-btn-toggle v-model="navMethod.positionType" group mandatory>
              <v-btn
                v-for="positionType in creatablePositionTypes"
                :key="positionType.key"
                :value="positionType.key"
                variant="outlined"
              >
                {{ positionType.name }}
              </v-btn>
            </v-btn-toggle>
          </div>
        </v-col>
        <v-col
          v-if="valuationTypes.length"
          cols="12"
          sm="6"
        >
          <v-label class="mb-2">
            Valuation Type
          </v-label>
          <div class="toggle_buttons">
            <v-btn-toggle v-model="navMethod.valuationType" group mandatory>
              <v-btn
                v-for="valuationType in valuationTypes"
                :key="valuationType.key"
                :value="valuationType.key"
                variant="outlined"
              >
                {{ valuationType.name }}
              </v-btn>
            </v-btn-toggle>
          </div>
        </v-col>
      </v-row>

      <v-row class="mt-10">
        <v-col>
          <strong>Method Details</strong>
        </v-col>
      </v-row>
      <v-row>
        <template v-if="navMethod.positionType === PositionType.Composable">
          <v-col>
            <v-expansion-panels v-model="expandedPanels">
              <v-expansion-panel
                v-for="(method, index) in navMethod.details[navMethod.positionType]"
                :key="index"
                eager
              >
                <v-expansion-panel-title static>
                  <div class="method_details_title">
                    <span>
                      <strong class="me-1">{{ index + 1 }})</strong> METHOD DETAILS
                    </span>
                    <UiTextBadge
                      class="method_details_status"
                      :class="{'method_details_status--valid': method.isValid}"
                    >
                      <template v-if="method.isValid">
                        Provided
                        <Icon icon="octicon:check-circle-16" height="1.2rem" width="1.2rem" />
                      </template>
                      <template v-else>
                        Incomplete
                        <Icon icon="pajamas:error" height="1.2rem" width="1.2rem" />
                      </template>
                    </UiTextBadge>

                    <UiDetailsButton small @click.stop="deleteMethod(index)">
                      <v-icon
                        icon="mdi-delete"
                        color="error"
                      />
                    </UiDetailsButton>
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
          </v-col>
        </template>

        <template v-else>
          <FundNavMethodDetails
            v-model="navMethod.details[navMethod.positionType][0]"
            :position-type="navMethod.positionType"
            :valuation-type="navMethod.valuationType"
          />
        </template>
      </v-row>
      <!-- Add Position Details if the selected position type is composable. -->
      <v-row v-if="navMethod.positionType === PositionType.Composable">
        <v-col class="text-center">
          <v-btn
            class="text-secondary"
            variant="outlined"
            @click="addMethodDetails"
          >
            <template #append>
              <Icon
                icon="octicon:plus-circle-16"
                height="1.2rem"
                width="1.2rem"
              />
            </template>
            Add Method Details
          </v-btn>
        </v-col>
      </v-row>

      <v-row class="mt-4">
        <v-col class="text-end">
          <v-btn
            :disabled="!formIsValid || !areAllMethodDetailsValid"
            @click="addMethod"
          >
            Add Method
          </v-btn>
        </v-col>
      </v-row>
    </v-form>

    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
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

const form = ref(null);
const formIsValid = ref(false);

const getNewMethodDetails = (positionType: PositionType, valuationType: ValuationType) => {
  const newDetails: Record<string, any> = {
    isValid: false,
  };
  const fields = PositionTypeValuationTypeFieldsMap[positionType][valuationType || "undefined"] || []

  // let updated = false;
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
  console.log("remove0 method: ", index);
  navMethod.value.details[navMethod.value.positionType].splice([index])
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
.main_header {
  min-height: 40px;

  &__title {
    display: flex;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
}
.tooltip{
  &__content{
    display: flex;
    gap: 40px;
  }
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}

.info-icon {
  cursor: pointer;
  display: flex;
  color: $color-text-irrelevant;
}
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
:deep(.v-expansion-panel-title) {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.method_details_title {
  display: flex;
  align-items: center;
  gap: 1rem;
  letter-spacing: 0.02625rem;
  font-weight: 500;
  color: $color-text-irrelevant;
}
.method_details_status {
  color: $color-warning;

  &--valid {
    color: $color-success;
  }
}
// toggle buttons
.toggle_buttons {
  .v-btn-toggle {
    display: flex;
    gap: 10px;

    .v-btn {
      opacity: 0.35;
      color: $color-text-irrelevant;
      border-radius: 4px !important;
      @include borderGray;
    }
    .v-btn--active {
      color: $color-white !important;
      opacity: 1;
    }
  }
}
</style>
