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
                v-model="positionName"
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
                v-model="valuationSource"
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
                <v-btn-toggle v-model="positionType" group>
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
                <v-btn-toggle v-model="valuationType" group>
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
            <!-- TODO for composable do if statement and display all method.details rows -->
            <template v-if="positionType === PositionType.Composable">
              combo bitch
            </template>
            <template v-else>
              <FundNavMethodDetails
                v-model="navEntry.details[positionType][0]"
                :position-type="positionType"
                :valuation-type="valuationType"
                @validate="updateDetailsValid(0, $event)"
              />
            </template>
          </v-row>

          <v-row class="mt-4">
            <v-col class="text-end">
              <v-btn
                :disabled="!formIsValid || !areAllMethodsValid"
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
  PositionType, PositionTypeKeys,
  PositionTypes, PositionTypeToNAVEntryTypeMap,
  PositionTypeToValuationTypesMap,
  PositionTypeValuationTypeDefaultFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const { selectedFundSlug } = toRefs(fundStore);


const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Manage NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav/manage`,
  },
  {
    title: "Define New Method",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage/newMethod`,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});

// Currently we don't support creating a NFT position, so we exclude it here.
const creatablePositionTypes = PositionTypes.filter(positionType => positionType.key !== PositionType.NFT)
const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[positionType.value].map(type => ValuationTypesMap[type]),
);
const defaultFields = computed(() =>
  PositionTypeValuationTypeDefaultFieldsMap[positionType.value][valuationType.value || "undefined"] || [],
);
const areAllMethodsValid = computed(() =>
  // Return true if all methods are valid, otherwise false.
  !methodsValid.value.some(method => !method),
);

const form = ref(null);
const formIsValid = ref(false);
// Array for validating every method's details.
const methodsValid = ref([false]);

const positionName = ref("");
const valuationSource = ref("");
const positionType = ref<PositionType>(PositionType.Liquid);
const valuationType = ref<ValuationType>(ValuationType.DEXPair);

// We define an array of NAV methods. In reality only PositionType.Composable can have multiple methods.
// All other position types can have only one NAV method.
const navEntry = ref<INAVMethod>({
  positionName: positionName.value,
  valuationSource: valuationSource.value,
  positionType: positionType.value,
  valuationType: valuationType.value,
  details: {
    // Init as PositionType.Liquid & ValuationType.DEXPair
    liquid: [
      {},
    ],
    illiquid: [],
    nft: [],
    composable: [],
  },
  detailsJson: "{}",
},
);

const resetMethods = () => {
  const tmpMethod = {
    positionName: positionName.value,
    valuationSource: valuationSource.value,
    positionType: positionType.value,
    valuationType: valuationType.value,
    details: {},
    detailsJson: "{}",
  } as INAVMethod;
  for (const positionTypeKey of PositionTypeKeys) {
    tmpMethod.details[positionTypeKey] = [];
  }
  // Init empty details for the selected position type (liquid, illiquid, nft, composable).
  tmpMethod.details[positionType.value].push({});

  tmpMethod.detailsJson = formatJson(tmpMethod.details);

  navEntry.value = tmpMethod;
}

watch(() => positionType.value, (newPositionType) => {
  // Dynamically set valuation type based on the selected position type.
  valuationType.value = PositionTypeToValuationTypesMap[newPositionType][0];

  // Reset method details when positionType changes.
  resetMethods();
});
watch(() => valuationType.value, () => {
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
const updateDetailsValid = (index: number, isValid: boolean) => {
  console.log("ind: ", index, " isValid: ", isValid);
  methodsValid.value[index] = isValid;
};


const addMethod = () => {
  console.log(navEntry.value);
  if (!formIsValid.value || !areAllMethodsValid.value)  {
    return toastStore.warningToast(
      "Some form fields are not valid.",
    );
  }

  // Set default fields that are required for each entry.
  // In most cases methods will be only one method, only if the PositionType is Composable, there can be
  // more than 1 method, and we will create a new NAV entry for each of them, with the same position name...
  // - NFT (composable) can have more than 1 method, so take all methods in details.
  // - All other Position Types can only have 1 method, so take the first one (there should only be one).
  navEntry.value.positionName = positionName.value;
  navEntry.value.valuationSource = valuationSource.value;
  navEntry.value.positionType = positionType.value;
  navEntry.value.valuationType = valuationType.value;

  // All methods details have this data.
  // TODO check if we need to convert any field to number by map like entryType
  navEntry.value.details.isPastNAVUpdate = false;
  navEntry.value.details.pastNAVUpdateIndex = 0;
  navEntry.value.details.pastNAVUpdateEntryIndex = 0;
  navEntry.value.details.pastNAVUpdateEntryFundAddress = fundStore.fund?.address;
  navEntry.value.details.entryType = PositionTypeToNAVEntryTypeMap[navEntry.value.positionType];
  navEntry.value.details.valuationType = valuationType.value; // TODO convert also?
  navEntry.value.details.description = {
    positionName: navEntry.value.positionName,
    valuationSource: navEntry.value.valuationSource,
  };

  // TODO add additional check that all methods have the same pastNAVUpdateIndex
  // Iterate over all NAV entry methods.
  for (const method of navEntry.value.details[positionType.value]) {
    // Set default data for each entry's method's position & valuation type.
    defaultFields.value.forEach(field => {
      method[field.key] = field.value;
    });

    if ("pastNAVUpdateIndex" in method) {
      navEntry.value.details.pastNAVUpdateIndex = method.pastNAVUpdateIndex;
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
    if (positionType.value === PositionType.Liquid && valuationType.value === ValuationType.DEXPair) {
      method.nonAssetTokenAddress = fundStore.fund?.baseToken?.address;
    }

  }
  // JSONIFY method details:
  navEntry.value.detailsJson = formatJson(navEntry.value.details);
  navEntry.value.detailsHash = ethers.keccak256(ethers.toUtf8Bytes(navEntry.value.detailsJson))
  console.log("New Method JSON: ", navEntry.value.detailsJson);

  // Add newly defined NAV entry to fund managed methods.
  fundStore.fundManagedNAVMethods.push(navEntry.value);

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
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
</style>
