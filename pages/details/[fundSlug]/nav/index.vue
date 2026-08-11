<template>
  <div class="nav">
    <div class="nav__header">
      <div class="nav__headline">
        <v-skeleton-loader
          v-if="isLoadingFetchFundNAVUpdatesAction"
          type="text"
          class="total_nav_skeleton"
        />
        <div v-else class="nav__total">
          {{ fundTotalNAVFormatted }}
        </div>
        <div class="nav__caption">
          Total NAV · last updated {{ fundLastNAVUpdateDate }}
        </div>
      </div>

      <div class="nav__actions">
        <nuxt-link
          v-if="appSettingsStore.isManageMode"
          :to="`/details/${selectedFundSlug}/nav/manage`"
          class="nav__manage_link"
        >
          Manage NAV methods
        </nuxt-link>

        <div v-if="appSettingsStore.isManageMode" class="tooltip-wrapper">
          <v-tooltip
            activator="parent"
            location="bottom"
            :disabled="!curatorDisabledReason"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!canExecuteAsCurator || isLoadingPostUpdateNAV"
                class="bg-primary text-secondary"
                @click="canExecuteAsCurator ? fundStore.postUpdateNAV() : null"
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
              {{ curatorDisabledReason }}
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>

    <div class="nav__card brand_card">
      <div class="brand_card__head">
        <div class="brand_card__eyebrow">
          NAV methods
        </div>
        <UiInfoBox
          info="Learn more about NAV methods"
          :icon="true"
          link="https://docs.rethink.finance/rethink.finance/protocol/architecture/nav-calculator-contract"
        />
      </div>
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

    <div class="nav__card brand_card">
      <div class="brand_card__eyebrow nav__updates_title">
        NAV updates
      </div>
      <FundNavUpdates :fund="reversedFundNavUpdates" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

const fund = useAttrs().fund as IFund;
const {
  selectedFundSlug,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = storeToRefs(useFundStore());

// Curators execute straight from their own wallet — the calldata is wrapped
// in the vault's Roles modifier, no Zodiac Pilot session needed.
const {
  canExecute: canExecuteAsCurator,
  disabledReason: curatorDisabledReason,
} = useCuratorExecution();

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
  display: flex;
  flex-direction: column;
  gap: 1.375rem;

  /* Design's page head: the figure carries the row, buttons sit at the end. */
  &__header {
    display: flex;
    align-items: flex-end;
    gap: 1.75rem;
    flex-wrap: wrap;
  }

  &__headline {
    display: flex;
    flex-direction: column;
    gap: 0.4375rem;
    margin-right: auto;
  }

  &__total {
    font-family: $font-mono;
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__caption {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__manage_link {
    padding: 0.5625rem 0.875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 13px;
    font-weight: 600;
    color: $color-text-irrelevant;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }

  &__card {
    /* brand_card provides chrome; margins come from the page flex gap. */
    margin-bottom: 0;
  }

  &__updates_title {
    margin-bottom: 1rem;
  }
}

.total_nav_skeleton :deep(.v-skeleton-loader__bone) {
  height: 2rem;
  width: 12rem;
  margin: 0;
}
</style>
