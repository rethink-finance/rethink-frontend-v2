<template>
  <div class="new_method">
    <v-form ref="form" v-model="formIsValid">
      <v-container>
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
              hide-details
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
              hide-details
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
                  v-for="positionType in PositionTypes"
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
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund.store";
import { PositionType, PositionTypes, PositionTypeToValuationTypesMap } from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import { useToastStore } from "~/store/toast.store";
import { formatJson } from "~/composables/utils";

const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const { selectedFundSlug } = toRefs(useFundStore());

const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[method.value.positionType].map(type => ValuationTypesMap[type]),
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
  if (!formIsValid || !detailsAreValid)  {
    return toastStore.warningToast(
      "Some form fields are not valid.",
    );
  }

  // JSONIFY method details:
  // - NFT (composable) can have more than 1 method, so take all methods in details.
  // - All other Position Types can only have 1 method, so take the first one (there should only be one).
  const details = method.value.positionType === PositionType.NFT ? method.value.details : method.value.details[0];
  method.value.detailsJson = formatJson(details);

  // Add newly defined method to fund managed methods.
  fundStore.fundManagedNAVMethods.push(method.value);

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Method added successfully.")
}
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
