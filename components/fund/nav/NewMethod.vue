<template>
  <div class="new_method">
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
          <v-label> Position Name </v-label>
          <v-text-field
            v-model="method.positionName"
            placeholder="WETH"
            hide-details
            required
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-label> Valuation Source </v-label>
          <v-text-field
            v-model="method.valuationSource"
            placeholder="Uniswap ETH/USDC"
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
        />
      </v-row>
    </v-container>

    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  PositionType,
  PositionTypes,
  PositionTypeToValuationTypesMap,
} from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";

// const emit = defineEmits(["methodCreated"]);

const valuationTypes = computed(() =>
  PositionTypeToValuationTypesMap[method.value.positionType].map(type => ValuationTypesMap[type]),
);

interface IMethod {
  positionName: string,
  valuationSource: string,
  positionType: PositionType,
  valuationType: ValuationType,
  details: Record<string, any>[]
}
const method = ref<IMethod>({
  positionName: "",
  valuationSource: "",
  positionType: PositionType.Liquid,
  valuationType: ValuationType.DEXPair,
  details: [
    {},
  ],
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
watch(() => method.value.details[0], (newVal) => {
  console.log("Details updated:", newVal);
});

// const valueRules = [
//   (value: string) => {
//     // TODO check if valid address 0x0123...123
//     const valueWei = Number(value);
//     if (valueWei <= 0) return "Value must be positive."
//     return true;
//   },
// ];

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
