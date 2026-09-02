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

    <!-- The card supplies the frame and the table runs edge to edge inside
         it, the way the design draws it: eyebrow in the head, rows on
         hairlines below, the total closing the card. Re-simulating lives on
         the Simulated column head, as it does on the manage page. -->
    <div class="nav__card brand_card nav__card--flush">
      <div class="nav__card_head">
        <div class="brand_card__eyebrow">
          NAV methods
        </div>
      </div>
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
        frameless
        idx="fundSlug/nav/index"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { ActionState } from "~/types/enums/action_state";

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

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

    /* The rows draw their own inset, so the card keeps none — and clips, so
       the tinted total row ends on the card's rounded corners. */
    &--flush {
      padding: 0;
      overflow: hidden;
    }
  }

  &__card_head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 20px 24px 16px;
  }

  @media (prefers-reduced-motion: reduce) {
    &__manage_link {
      transition: none;
    }
  }
}

.total_nav_skeleton :deep(.v-skeleton-loader__bone) {
  height: 2rem;
  width: 12rem;
  margin: 0;
}
</style>
