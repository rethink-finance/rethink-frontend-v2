<template>
  <div class="overview">
    <v-expansion-panels variant="accordion">
      <v-expansion-panel class="main_expansion_panel" eager>
        <v-expansion-panel-title class="main_expansion_panel__title section_title main_card" static>
          Overview
        </v-expansion-panel-title>
        <v-expansion-panel-text class="main_expansion_panel__body">
          <div class="main_card">
            <div class="main_expansion_panel__subtitle">
              Basics
            </div>
            <div>
              <FundOverviewBasics :fund="fund" />
            </div>
          </div>

          <div class="main_card">
            <div class="main_expansion_panel__subtitle">
              Deposits
            </div>
            <div>
              <FundOverviewDeposits :fund="fund" />
            </div>
          </div>

          <div class="main_card">
            <div class="main_expansion_panel__subtitle">
              Management
            </div>
            <div>
              <FundOverviewManagement :fund="fund" />
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  name: "Overview",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
};
</script>

<style lang="scss" scoped>
.main_card {
  margin-bottom: 0;
}
</style>
