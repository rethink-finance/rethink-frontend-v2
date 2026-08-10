<template>
  <div class="fund_governance brand_card">
    <div class="brand_card__head">
      <div class="brand_card__eyebrow">
        Governance
      </div>
      <NuxtLink :to="governanceRoute" class="fund_governance__open">
        Open governance
      </NuxtLink>
    </div>

    <div class="fund_governance__grid">
      <div
        v-for="setting in governanceSettings"
        :key="setting.label"
        class="fund_governance__grid_row"
      >
        <div class="fund_governance__grid_label">
          {{ setting.label }}
        </div>
        <div class="fund_governance__grid_value">
          {{ setting.value }}
        </div>
      </div>
    </div>

    <div v-if="isConnected" class="fund_governance__strip">
      <div class="fund_governance__stat">
        <div class="fund_governance__label">
          My delegation
        </div>
        <div class="fund_governance__value">
          <template v-if="isZeroAddress(fundStore.fundUserData.fundDelegateAddress)">
            N/A
          </template>
          <template v-else>
            <v-tooltip
              activator="parent"
              location="bottom"
              content-class="brand_tooltip"
            >
              <div class="brand_tooltip__value">
                {{ fundStore.fundUserData.fundDelegateAddress }}
              </div>
            </v-tooltip>
            {{ parsedDelegatingToAddress }}
          </template>
        </div>
      </div>

      <div class="fund_governance__stat">
        <div class="fund_governance__label">
          My voting power
        </div>
        <div class="fund_governance__value">
          {{ userGovernanceTokenBalanceFormatted }}
          {{ fund.governanceToken.symbol }}
        </div>
      </div>

      <button
        type="button"
        class="fund_governance__delegate"
        @click="isDelegateDialogOpen = true"
      >
        Manage delegation
      </button>
    </div>

    <FundGovernanceModalDelegateVotes v-model="isDelegateDialogOpen" />
  </div>
</template>

<script setup lang="ts">
import { isZeroAddress } from "~/composables/addressUtils";
import { useFundStore } from "~/store/fund/fund.store";
import { useAccountStore } from "~/store/account/account.store";
import type IFund from "~/types/fund";
const fundStore = useFundStore();
const { isConnected } = storeToRefs(useAccountStore());
const route = useRoute();

const isDelegateDialogOpen = ref(false);

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

// This card only renders on the vault overview, so the current path is already
// the vault root — the governance section hangs directly off it.
const governanceRoute = computed(
  () => `${route.path.replace(/\/$/, "")}/governance`,
);

/**
 * The vault's governance parameters, mirrored from the design's settings
 * grid. Values arrive from the store already humanized ("1 day", "10%").
 */
const governanceSettings = computed(() => {
  const fund = props.fund;
  const governedBy = fund?.originalFundSettings?.isExternalGovTokenInUse
    ? truncateAddress(fund?.governanceToken?.address ?? "")
    : "Depositors";
  return [
    { label: "Governed by", value: governedBy },
    { label: "Voting delay", value: fund?.votingDelay || "N/A" },
    { label: "Voting period", value: fund?.votingPeriod || "N/A" },
    // Arrives already carrying the token symbol ("150,000 veSHN").
    { label: "Proposal threshold", value: fund?.proposalThreshold || "N/A" },
    { label: "Quorum", value: fund?.quorumPercentage || "N/A" },
    { label: "Late quorum", value: fund?.lateQuorum || "N/A" },
  ];
});

const userGovernanceTokenBalanceFormatted = computed(() => {
  return formatTokenValue(
    fundStore.fundUserData.governanceTokenBalance,
    props.fund?.governanceToken.decimals,
    false,
    true,
  );
});

const parsedDelegatingToAddress = computed(() => {
  // check if the user delegated to himself
  if (fundStore.fundUserData.fundDelegateAddress.toLowerCase() === fundStore?.activeAccountAddress?.toLowerCase()) {
    return "Myself";
  }

  return truncateAddress(fundStore.fundUserData.fundDelegateAddress);
});
</script>

<style lang="scss" scoped>
.fund_governance {
  &__open {
    padding: 0.375rem 0.75rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-size: 12px;
    font-weight: 600;
    color: $color-cyan;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    column-gap: 2.5rem;
    margin-bottom: 1rem;
  }

  &__grid_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
    padding: 0.75rem 0;
    border-bottom: 1px solid $color-line;
  }

  &__grid_label {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__grid_value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-align: right;
    @include ellipsis;
  }

  /* The design pulls the viewer's own delegation state out of the settings
     list and into a tinted strip, so it reads as "yours" rather than as one
     more vault parameter. */
  &__strip {
    display: flex;
    align-items: center;
    gap: 1.75rem;
    flex-wrap: wrap;
    padding: 0.875rem 1.125rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__value {
    position: relative;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
  }

  &__delegate {
    margin-left: auto;
    padding: 0.4375rem 0.875rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    font-size: 12.5px;
    font-weight: 600;
    color: $color-white;
    white-space: nowrap;
    transition: border-color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
  }
}
</style>
