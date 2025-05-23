<template>
  <div class="nav">
    <UiHeader>
      <div>
        <div class="main_header__title">
          <v-skeleton-loader v-if="isLoadingFetchFundNAVUpdatesAction" type="text" class="total_nav_skeleton" />
          <template v-else>
            {{ fundTotalNAVFormatted }}
          </template>
        </div>
        <div class="main_header__subtitle">
          <div>
            Last updated on
          </div>
          <v-skeleton-loader v-if="isLoadingFetchFundNAVUpdatesAction" type="text" class="last_nav_update_skeleton" />
          <strong v-else class="ms-2">{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
      <div class="button_container">
        <nuxt-link v-if="appSettingsStore.isManageMode" :to="`/details/${selectedFundSlug}/nav/manage`">
          <v-btn class="text-secondary" variant="outlined">
            Manage NAV Methods
          </v-btn>
        </nuxt-link>


        <div
          v-if="appSettingsStore.isManageMode"
          class="tooltip-wrapper"
        >
          <v-tooltip
            activator="parent"
            location="bottom"
            :disabled="isUsingZodiacPilotExtension"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!isUsingZodiacPilotExtension || isLoadingPostUpdateNAV"
                class="bg-primary text-secondary"
                @click="accountStore.isConnected ? fundStore.postUpdateNAV() : null"
              >
                <template #prepend>
                  <v-progress-circular
                    v-if="isLoadingPostUpdateNAV"
                    class="d-flex"
                    size="20"
                    width="3"
                    indeterminate
                  />
                </template>
                Update NAV
              </v-btn>
            </template>

            <template #default>
              Switch to the Zodiac Pilot Extension to Update NAV.
            </template>
          </v-tooltip>
        </div>
      </div>
    </UiHeader>

    <div class="main_card">
      <UiHeader>
        <div>
          <div class="subtitle_white mb-4">
            NAV Methods
          </div>
          <div>
            <UiInfoBox
              info="Learn more about NAV methods"
              :icon="true"
              link="https://docs.rethink.finance/rethink.finance/protocol/architecture/nav-calculator-contract"
            />
          </div>
        </div>
      </UiHeader>
      <div class="methods main_grid main_grid--full-width main_grid--no-gap">
        <FundNavMethodsTable
          :fund-chain-id="fundStore.selectedFundChain"
          :fund-address="fundStore.fundAddress"
          :fund-contract-base-token-balance="Number(fundStore.fund?.fundContractBaseTokenBalance)"
          :safe-contract-base-token-balance="Number(fundStore.fund?.safeContractBaseTokenBalance)"
          :fee-balance="Number(fundStore.fund?.feeBalance)"
          :safe-address="fundStore.fund?.safeAddress"
          :base-symbol="fundStore.fund?.baseToken.symbol"
          :base-decimals="fundStore.fund?.baseToken.decimals"
          :methods="fundComputedNavMethods"
          :loading="isLoadingFetchFundNAVUpdatesAction"
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
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const accountStore = useAccountStore();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

const fund = useAttrs().fund as IFund;
const {
  isUsingZodiacPilotExtension,
  selectedFundSlug,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = storeToRefs(useFundStore());

const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate?.value?.date) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
});
const fundComputedNavMethods = computed(() => {
  if (fundLastNAVUpdate?.value?.date) return fundLastNAVUpdateMethods.value || [];
  return fundStore.fundInitialNAVMethods || [];
});

const fundTotalNAVFormatted = computed(() => {
  if (!fundStore.fundTotalNAV) return "N/A";
  return fundStore.getFormattedBaseTokenValue(fundStore.fundTotalNAV)
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

const isLoadingPostUpdateNAV = computed(() => {
  return actionStateStore.isActionState("postUpdateNAVAction", ActionState.Loading);
});
const isLoadingFetchFundNAVUpdatesAction = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
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
