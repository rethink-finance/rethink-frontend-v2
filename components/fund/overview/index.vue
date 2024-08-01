<template>
  <div class="overview">
    <v-expansion-panels v-model="openPanel" variant="accordion">
      <v-expansion-panel class="main_expansion_panel" value="overview" eager>
        <v-expansion-panel-title class="main_expansion_panel__title main_card" static>
          OIV Settings
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
              Whitelist
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
          <div class="main_card">
            <div class="main_expansion_panel__subtitle">
              Fees
            </div>
            <div>
              <FundOverviewFees :fund="fund" />
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel
        v-if="isOverviewPanelOpen"
        class="main_expansion_panel"
        value="collapse"
        eager
      >
        <v-expansion-panel-title
          class="main_expansion_panel__title main_card"
          static
        >
          Collapse
          <template #actions="">
            <v-icon color="primary" icon="mdi-chevron-up" />
          </template>
        </v-expansion-panel-title>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});

const openPanel = ref<string | undefined>(undefined);
const isOverviewPanelOpen = computed(() => openPanel.value === "overview");
</script>

<style lang="scss" scoped>
.overview{
  margin-bottom: 2rem;
}
.main_expansion_panel{
  border: 0;
  border-radius: 0.25rem !important;
  background-color: rgb(var(--v-theme-surface));
}
.main_expansion_panel__title{
  height: 3.5rem;
}
</style>
