<template>
  <div class="nav">
    <UiHeader>
      <div>
        <div class="main_header__title">
          {{ fundTotalNAVFormattedShort }}
        </div>
        <div class="main_header__subtitle">
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
    </UiHeader>

    <div class="main_card">
      <UiHeader>
        <div>
          <div class="main_expansion_panel__subtitle mb-4">
            NAV Methods
          </div>
          <div>
            <a
              class="nav__learn_more_link"
              href="https://docs.rethink.finance/rethink.finance/protocol/nav-calculator-contract"
            >
              Learn more about NAV methods ->
            </a>
          </div>
        </div>
        <div>
          <nuxt-link
            :to="`/details/${selectedFundSlug}/nav/manage`"
          >
            <v-btn
              class="text-secondary"
              variant="outlined"
            >
              Manage Methods
            </v-btn>
          </nuxt-link>
        </div>
      </UiHeader>
      <div class="methods main_grid main_grid--full-width main_grid--no-gap">
        <FundNavMethodsTable :methods="fundLastNAVUpdateEntries" />
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
const { fundTotalNAVFormattedShort, selectedFundSlug, fundLastNAVUpdate, fundLastNAVUpdateEntries } = toRefs(useFundStore());

const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate.value) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
})
</script>

<style scoped lang="scss">
.nav {
  &__learn_more_link {
    font-weight: 500;
    color: $color-primary;
  }
}
</style>
