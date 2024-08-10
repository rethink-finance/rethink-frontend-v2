<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Define New Method
      </div>
    </UiHeader>

    <div class="main_card">
      <v-form ref="form" v-model="formIsValid">
        <v-container fluid>
          <v-row>
            <v-col>
              <strong>Position Method</strong>
            </v-col>
          </v-row>
          <v-row>
            <v-col
              cols="12"
              sm="6"
            >
              <v-label class="label_required">
                Position Name
              </v-label>
              <v-text-field
                v-model="navEntry.positionName"
                placeholder="E.g. WETH"
                :rules="rules"
                required
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
            >
              <v-label class="label_required">
                Valuation Source
              </v-label>
              <v-text-field
                v-model="navEntry.valuationSource"
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
              <v-label>
                Position Type
              </v-label>
              <div>
                <v-btn-toggle v-model="navEntry.positionType" group>
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
              <v-label> Valuation Type </v-label>
              <div>
                <v-btn-toggle v-model="navEntry.valuationType" group>
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

          <v-row class="mt-4">
            <v-col>
              <strong>Method Details</strong>
            </v-col>
          </v-row>
          <v-row>
            <template v-if="navEntry.positionType === PositionType.Composable">
              <v-col>
                <v-expansion-panels v-model="expandedPanels">
                  <v-expansion-panel
                    v-for="(method, index) in navEntry.details[navEntry.positionType]"
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
                      <v-row>
                        <FundNavMethodDetails
                          v-model="navEntry.details[navEntry.positionType][index]"
                          :position-type="navEntry.positionType"
                          :valuation-type="navEntry.valuationType"
                        />
                      </v-row>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-col>
            </template>

            <template v-else>
              <FundNavMethodDetails
                v-model="navEntry.details[navEntry.positionType][0]"
                :position-type="navEntry.positionType"
                :valuation-type="navEntry.valuationType"
              />
            </template>
          </v-row>
          <!-- Add Position Details if the selected position type is composable. -->
          <v-row v-if="navEntry.positionType === PositionType.Composable">
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
        </v-container>
      </v-form>

      <div class="buttons_container">
        <slot name="buttons" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import {
  defaultInputTypeValue, InputType,
  PositionType, PositionTypeKeys,
  PositionTypes, PositionTypeToNAVEntryTypeMap,
  PositionTypeToValuationTypesMap,
  PositionTypeValuationTypeDefaultFieldsMap, PositionTypeValuationTypeFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const { selectedFundSlug } = toRefs(fundStore);
const expandedPanels = ref([0]);

const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Create NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav/proposal`,
  },
  {
    title: "Define New Method",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/newMethod`,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

// Currently we don't support creating a NFT position, so we exclude it here.
const creatablePositionTypes = PositionTypes.filter(positionType => positionType.key !== PositionType.NFT)
const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[navEntry.value.positionType].map(type => ValuationTypesMap[type]),
);
const defaultFields = computed(() =>
  PositionTypeValuationTypeDefaultFieldsMap[navEntry.value.positionType][navEntry.value.valuationType || "undefined"] || [],
);
const areAllMethodDetailsValid = computed(() =>
  // Return true if all methods are valid, otherwise false.
  !navEntry.value.details[navEntry.value.positionType].some((method: any) => !method.isValid),
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

const navEntry = ref<INAVMethod>({
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
    positionName: navEntry.value.positionName,
    valuationSource: navEntry.value.valuationSource,
    positionType: navEntry.value.positionType,
    valuationType: navEntry.value.valuationType,
    details: {},
    detailsJson: "{}",
  } as INAVMethod;
  for (const positionTypeKey of PositionTypeKeys) {
    tmpNavEntry.details[positionTypeKey] = [];
  }
  // Init empty details for the selected position type (liquid, illiquid, nft, composable).
  tmpNavEntry.details[navEntry.value.positionType].push(
    getNewMethodDetails(navEntry.value.positionType, navEntry.value.valuationType),
  );

  tmpNavEntry.detailsJson = formatJson(tmpNavEntry.details);

  navEntry.value = tmpNavEntry;
}

const deleteMethod = (index: number) => {
  console.log("remove0 method: ", index);
  navEntry.value.details[navEntry.value.positionType].splice([index])
}


const addMethodDetails = () => {
  navEntry.value.details[navEntry.value.positionType].push(
    getNewMethodDetails(navEntry.value.positionType, navEntry.value.valuationType),
  );
}

watch(() => navEntry.value.positionType, (newPositionType) => {
  // Dynamically set valuation type based on the selected position type.
  navEntry.value.valuationType = PositionTypeToValuationTypesMap[newPositionType][0];

  // Reset method details when positionType changes.
  resetMethods();
});
watch(() => navEntry.value.valuationType, () => {
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
  console.log(navEntry.value);
  // TODO remove isValid from every method details navEntry
  // TODO check validation
  if (!formIsValid.value || !areAllMethodDetailsValid.value)  {
    return toastStore.warningToast(
      "Some form fields are not valid.",
    );
  }

  const newNavEntry = JSON.parse(JSON.stringify(navEntry.value));

  // Do not include the pastNAVUpdateEntryFundAddress in the details, as when we fetch entries
  // they don't include this data and details hash would be broken if we included it.
  newNavEntry.pastNAVUpdateEntryFundAddress = fundStore.fund?.address;

  // Set default fields that are required for each entry.
  // All methods details have this data.
  // TODO check if we need to convert any field to number by map like entryType
  newNavEntry.details.isPastNAVUpdate = false;
  newNavEntry.details.pastNAVUpdateIndex = 0;
  newNavEntry.details.pastNAVUpdateEntryIndex = 0;
  newNavEntry.details.entryType = PositionTypeToNAVEntryTypeMap[navEntry.value.positionType];
  newNavEntry.details.valuationType = navEntry.value.valuationType; // TODO convert also?
  newNavEntry.details.description = {
    positionName: navEntry.value.positionName,
    valuationSource: navEntry.value.valuationSource,
  };

  // TODO add additional check that all methods have the same pastNAVUpdateIndex
  // Iterate over all NAV entry methods.
  // In most cases methods will be only one method, only if the PositionType is Composable, there can be
  // more than 1 method, and we will create a new NAV entry for each of them, with the same position name...
  // - NFT (composable) can have more than 1 method, so take all methods in details.
  // - All other Position Types can only have 1 method, so take the first one (there should only be one).
  for (const method of newNavEntry.details[newNavEntry.positionType]) {
    // Set default data for each entry's method's position & valuation type.
    defaultFields.value.forEach(field => {
      if (!(field.key in method)) {
        method[field.key] = field.value;
      }
    });

    if ("pastNAVUpdateIndex" in method) {
      newNavEntry.details.pastNAVUpdateIndex = method.pastNAVUpdateIndex;
    }

    if ("otcTxHashes" in method) {
      try {
        method.otcTxHashes = method.otcTxHashes.split(",").map(
          // Remove leading and trailing whitespace
          (hash: string) => hash.trim(),
        ).filter(
          // Remove empty strings;
          (hash: string) => hash !== "",
        ) || [];
      } catch (error: any) {
        return toastStore.errorToast("Something went wrong parsing the comma-separated list of TX hashes.")
      }
    }

    // Set other misc dynamic fields related to the current fund, specific for each position & valuation type.
    if (newNavEntry.positionType === PositionType.Liquid && newNavEntry.valuationType === ValuationType.DEXPair) {
      method.nonAssetTokenAddress = fundStore.fund?.baseToken?.address;
    }

    // Remove unwanted properties that we don't need when submitting the proposal.
    delete method.isValid;
    delete method.valuationType;
  }

  // Mark entry as new, so that it will be green in the table.
  newNavEntry.isNew = true;

  // JSONIFY method details:
  newNavEntry.detailsJson = formatJson(newNavEntry.details);
  newNavEntry.detailsHash = ethers.keccak256(ethers.toUtf8Bytes(newNavEntry.detailsJson))
  console.log("New Method JSON: ", newNavEntry.detailsJson);

  // Add newly defined NAV entry to fund managed methods.
  fundStore.fundManagedNAVMethods.push(newNavEntry);

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/proposal`);
  toastStore.addToast("Method added successfully.")
}
</script>

<style scoped lang="scss">
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
</style>
