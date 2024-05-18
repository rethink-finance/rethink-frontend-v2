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
            :rules="tokenValueRules"
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
            :rules="tokenValueRules"
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
          <v-label> Position Type </v-label>
          <div>
            <v-btn-toggle group>
              <v-btn v-for="positionType in PositionTypes" variant="outlined" value="center">
                {{ positionType.name }}
              </v-btn>
            </v-btn-toggle>
          </div>
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-label> Valuation Type </v-label>
          <div>
            <v-btn-toggle group>
              <v-btn v-for="valuationType in ValuationTypes" variant="outlined" value="center">
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
    </v-container>

    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { PositionTypes } from "~/types/enums/position_type";
import { ValuationTypes } from "~/types/enums/valuation_type";

const props = defineProps({
  modelValue: {
    type: String,
    default: "0",
  },
});

const emit = defineEmits(["update:modelValue"]);

const tokenValue = computed({
  get: () => props?.modelValue ?? "0",
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});

const tokenValueRules = [
  (value: string) => {
    const valueWei = Number(value);
    if (valueWei <= 0) return "Value must be positive."
    return true;
  },
];

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
