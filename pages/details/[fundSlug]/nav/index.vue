<template>
  <div class="nav">
    <UiHeader>
      <div>
        <div class="main_header__title">
          <v-skeleton-loader v-if="fundStore.loadingNavUpdates" type="text" class="total_nav_skeleton" />
          <template v-else>
            {{ fundTotalNAVFormatted }}
          </template>
        </div>
        <div class="main_header__subtitle">
          <div>
            Last updated on
          </div>
          <v-skeleton-loader v-if="fundStore.loadingNavUpdates" type="text" class="last_nav_update_skeleton" />
          <strong v-else class="ms-2">{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
      <div class="button_container">
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage`">
          <v-btn class="text-secondary" variant="outlined">
            Manage NAV Methods
          </v-btn>
        </nuxt-link>

        <ui-tooltip-click
          :hide-after="3000"
          :show-tooltip="!accountStore.isConnected"
        >
          <v-btn
            :disabled="loadingUpdateNav"
            class="bg-primary text-secondary"
            @click="accountStore.isConnected ? fundStore.updateNAV() : null"
          >
            <template #prepend>
              <v-progress-circular
                v-if="loadingUpdateNav"
                class="d-flex"
                size="20"
                width="3"
                indeterminate
              />
            </template>
            Update NAV
          </v-btn>

          <template #tooltip>
            Connect your wallet to delegate your votes
          </template>

        </ui-tooltip-click>
      </div>
    </UiHeader>

    <div class="main_card">
      <UiHeader>
        <div>
          <div class="subtitle_white mb-4">
            NAV Methods
          </div>
          <div>
            <nuxt-link
              class="nav__learn_more_link"
              href="https://docs.rethink.finance/rethink.finance/protocol/nav-calculator-contract"
              target="_blank"
            >
              Learn more about NAV methods ->
            </nuxt-link>
          </div>
        </div>
      </UiHeader>
      <div class="methods main_grid main_grid--full-width main_grid--no-gap">
        <FundNavMethodsTable
          :methods="fundLastNAVUpdateMethods"
          :loading="fundStore.loadingNavUpdates"
          :nav-parts="fundLastNAVUpdate?.navParts"
          show-summary-row
          show-last-nav-update-value
          show-base-token-balances
          show-simulated-nav
          idx="fundSlug/nav/index"
        />
      </div>
    </div>

    <div class="main_card">
      <div class="subtitle_white mb-4">
        NAV Updates
      </div>
      <div>
        <FundNavUpdates :fund="reversedFundNavUpdates" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const accountStore = useAccountStore();

const fund = useAttrs().fund as IFund;
const {
  selectedFundSlug,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
  loadingUpdateNav,
} = toRefs(useFundStore());

const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate?.value?.date) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
});

const fundTotalNAVFormatted = computed(() => {
  if (!fundStore.fundTotalNAV) return "N/A";
  return fundStore.formatBaseTokenValue(fundStore.fundTotalNAV)
});

// return fund with reversed navUpdates array to show the latest updates first
const reversedFundNavUpdates = computed(() => {
  if (!fund.navUpdates) return fund;

  return {
    ...fund,
    // Create a shallow copy of the navUpdates array and reverse it
    navUpdates: fund.navUpdates.slice().reverse(),
  };
});
</script>

<style scoped lang="scss">
.nav {
  &__learn_more_link {
    font-weight: 500;
    color: $color-primary;
  }
}
.total_nav_skeleton :deep(.v-skeleton-loader__bone) {
  height: 2rem;
  margin: 0;
}
.last_nav_update_skeleton :deep(.v-skeleton-loader__bone) {
  height: 1rem;
  width: 4rem;
  margin: 0.5rem 0 0 0.5rem;
}
.main_header__subtitle {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-content: center;
}

.button_container {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @include sm {
    flex-direction: row;
  }
}
</style>
