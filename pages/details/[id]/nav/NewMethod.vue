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
                v-model="method.positionName"
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
                v-model="method.valuationSource"
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
                <v-btn-toggle v-model="method.positionType" group>
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
                <v-btn-toggle v-model="method.valuationType" group>
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
            <FundNavMethodDetails
              v-model="method.details[0]"
              :position-type="method.positionType"
              :valuation-type="method.valuationType"
              @validate="updateDetailsValid"
            />
          </v-row>

          <v-row class="mt-4">
            <v-col class="text-end">
              <v-btn
                :disabled="!formIsValid || !detailsAreValid"
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
// import type IFund from "~/types/fund";
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import {
  PositionType,
  PositionTypes,
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
// const fund = useAttrs().fund as IFund;
// console.log(fund);


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
    to: `/details/${selectedFundSlug.value}/nav/newMethod`,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});

// Currently we don't support creating a NFT position, so we filter it here.
const creatablePositionTypes = PositionTypes.filter(positionType => positionType.key !== PositionType.NFT)
const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[method.value.positionType].map(type => ValuationTypesMap[type]),
);
const defaultFields = computed(() =>
  PositionTypeValuationTypeDefaultFieldsMap[method.value.positionType][method.value.valuationType || "undefined"] || [],
);

const form = ref(null);
const formIsValid = ref(false);
const detailsAreValid = ref(false);

const method = ref<INAVMethod>({
  positionName: "",
  valuationSource: "",
  positionType: PositionType.Liquid,
  valuationType: ValuationType.DEXPair,
  details: [
    {},
  ],
  detailsJson: "",
});

watch(() => method.value.positionType, (newPositionType) => {
  // Dynamically set valuation type based on the selected position type.
  method.value.valuationType = PositionTypeToValuationTypesMap[newPositionType][0];
  // Reset method details when valuationType change
  method.value.details = [{}];
});
watch(() => method.value.valuationType, () => {
  // Reset method details when valuationType change
  method.value.details = [{}];
});


/**
 * Handle form validation.
 * Both method fields & method details fields (MethodDetails.vue) have to be valid.
 **/
const rules = [
  formRules.required,
];
const updateDetailsValid = (isValid: boolean) => {
  detailsAreValid.value = isValid;
};


const addMethod = () => {
  console.log(method.value);
  if (!formIsValid.value || !detailsAreValid.value)  {
    return toastStore.warningToast(
      "Some form fields are not valid.",
    );
  }

  // TODO Add default fields that are required for each entry.
  // Set method description from position name and type.
  for (const methodDetails of method.value.details) {
    methodDetails.description = {
      positionName: method.value.positionName,
      valuationSource: method.value.valuationSource,
    }
    // All methods have this data.
    methodDetails.isPastNAVUpdate = false;
    methodDetails.pastNAVUpdateIndex = false;
    methodDetails.pastNAVUpdateEntryIndex = false;
    methodDetails.pastNAVUpdateEntryFundAddress = fundStore.fund?.safeAddress; // TODO check is this okay?

    const positionType = method.value.positionType;
    const valuationType = method.value.valuationType;

    // Set default data for each position & valuation type.
    defaultFields.value.forEach(field => {
      methodDetails[field.key] = field.value;
    });

    // Set other misc dynamic fields related to the current fund, specific for each position & valuation type.
    if (positionType === PositionType.Liquid && valuationType === ValuationType.DEXPair) {
      methodDetails.nonAssetTokenAddress = fundStore.fund?.baseToken?.address;
    }
  }

  // JSONIFY method details:
  // - NFT (composable) can have more than 1 method, so take all methods in details.
  // - All other Position Types can only have 1 method, so take the first one (there should only be one).
  const details = method.value.positionType === PositionType.NFT ? method.value.details : method.value.details[0];
  method.value.detailsJson = formatJson(details);
  console.log("New Method JSON: ", method.value.detailsJson);

  // Add newly defined method to fund managed methods.
  fundStore.fundManagedNAVMethods.push(method.value);

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
