<template>
  <div class="nav">
    <div class="nav__header">
      <div>
        <div class="nav__header_title">
          {{ fundTotalNAVFormattedShort }}
        </div>
        <div class="nav__header_subtitle">
          Last updated on <strong>{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
      <div>
        <v-btn
          class="text-secondary"
          variant="outlined"
        >
          Simulate NAV
        </v-btn>
        <v-btn class="bg-primary text-secondary ms-6">
          Update NAV
        </v-btn>
      </div>
    </div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        NAV Methods
      </div>
      <div>
        <FundNavMethods :fund="fund" />
      </div>
    </div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        NAV Updates
      </div>
      <div>
        <FundNavUpdates :fund="fund" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";

const fund = useAttrs().fund as IFund;
const { fundTotalNAVFormattedShort } = toRefs(useFundStore());

const fundLastNAVUpdateDate = computed(() => {
  if (!fund?.navUpdates.length) return "N/A";
  return fund.navUpdates[fund.navUpdates.length - 1]?.date ?? "N/A";
})
</script>

<style scoped lang="scss">
.nav {
  &__header {
    display: flex;
    justify-content: space-between;
    align-content: center;
    margin-bottom: 2.5rem;
  }
  &__header_title {
    font-size: $text-xl;
    color: $color-title;
    font-weight: 500;
    letter-spacing: $letter-spacing-lg;
  }
  &__header_subtitle {
    color: $color-text-irrelevant;
  }
}
</style>
