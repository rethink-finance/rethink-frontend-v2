<template>
  <div class="overview">
    <v-expansion-panels class="mb-6">
      <v-expansion-panel class="main_expansion_panel ">
        <v-expansion-panel-title class="main_expansion_panel__title section_title main_card">
          Overview
        </v-expansion-panel-title>
        <v-expansion-panel-text class="main_expansion_panel__body main_card">
          <div class="main_expansion_panel__subtitle">
            Basics
          </div>
          <div>
            <FundOverviewBasics />
          </div>

        </v-expansion-panel-text>
        <v-expansion-panel-text class="main_expansion_panel__body main_card">
          <div class="main_expansion_panel__subtitle">
            Basics
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";
import type IToken from "~/types/token";

export default {
  name: "Overview",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {
      actionButtonValue: "",
    };
  },
  computed: {
    getToken0(): IToken {
      if (this.actionButtonValue === "deposit") {
        return this.fund.fund_token;
      }
      return this.fund.denomination_token;
    },
    getToken1(): IToken {
      if (this.actionButtonValue === "deposit") {
        return this.fund.denomination_token;
      }
      return this.fund.fund_token;
    },
  },
  methods: {
    toggleActionButton(value: string) {
      if (this.actionButtonValue === value) {
        this.actionButtonValue = "";
      } else {
        this.actionButtonValue = value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  &__buttons {
    display: flex;
    gap: 1rem;
    margin: auto 0;
  }
  button.button-active {
    background-color: $color-white !important;
    color: $color-primary !important;
  }
  &__card_boxes {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
