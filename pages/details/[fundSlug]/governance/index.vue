<template>
  <div class="page-governance">
    <!-- Card A — the rules the vault is governed by. Collapsed by default:
         they answer a question most readers are not asking, and the activity
         below is what they came for. -->
    <div class="brand_card gov_settings">
      <button
        type="button"
        class="gov_settings__head"
        @click="isSettingsOpen = !isSettingsOpen"
      >
        <span class="brand_card__eyebrow">Governance settings</span>
        <Icon
          icon="octicon:chevron-down-16"
          class="gov_settings__chevron"
          :class="{ 'gov_settings__chevron--open': isSettingsOpen }"
          width="1rem"
          height="1rem"
        />
      </button>

      <div v-if="isSettingsOpen" class="gov_settings__grid">
        <div
          v-for="setting in governanceSettings"
          :key="setting.label"
          class="gov_settings__cell"
        >
          <div class="gov_settings__label">
            {{ setting.label }}
          </div>
          <div class="gov_settings__value">
            {{ setting.value }}
          </div>
        </div>
      </div>
    </div>

    <!-- Card B — governance activity -->
    <div class="brand_card gov_card">
      <div class="gov_card__head">
        <div class="gov_card__head_text">
          <div class="gov_card__title">
            Governance activity
          </div>
          <div class="gov_card__caption">
            {{ proposalsCaption }}
          </div>
        </div>

        <div class="gov_card__stat">
          <div class="gov_card__stat_value">
            {{ proposalsSuccessRate }}
          </div>
          <div class="gov_card__stat_label">
            Success rate
          </div>
        </div>

        <div
          v-if="appSettingsStore.isManageMode"
          v-click-outside="closeCreateMenu"
          class="gov_card__create"
        >
          <v-btn
            class="bg-primary text-secondary gov_card__create_button"
            @click="isCreateMenuOpen = !isCreateMenuOpen"
          >
            Create proposal
            <Icon
              icon="octicon:chevron-down-16"
              class="gov_card__create_chevron"
              :class="{ 'gov_card__create_chevron--open': isCreateMenuOpen }"
              width="0.875rem"
              height="0.875rem"
            />
          </v-btn>

          <div v-if="isCreateMenuOpen" class="gov_card__menu">
            <button
              v-for="option in createProposalOptions"
              :key="option.label"
              type="button"
              class="gov_card__menu_item"
              @click="selectOption(option.label)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="areProposalsUnavailable"
        class="brand_note brand_note--warning gov_card__note"
      >
        <Icon
          icon="material-symbols:warning-outline"
          class="brand_note__icon"
        />
        <div class="brand_note__body">
          <div class="brand_note__text">
            Proposals could not be refreshed for this network, so this list may
            be incomplete or out of date.
          </div>
        </div>
      </div>

      <FundGovernanceProposalsTable
        :items="governanceProposals"
        :loading="isFetchingProposals"
        :loading-variant="loadingProposalsVariant"
      />
    </div>

    <!-- Card C — trending delegates -->
    <div class="brand_card gov_card">
      <div class="gov_card__head">
        <div class="gov_card__head_text">
          <div class="gov_card__title">
            Trending delegates
          </div>
          <div class="gov_card__caption">
            {{ trendingDelegatesCaption }}
          </div>
        </div>

        <UiTooltipClick
          :hide-after="6000"
          :show-tooltip="!accountStore.isConnected"
        >
          <template #tooltip>
            Connect your wallet to delegate your votes
          </template>

          <button
            type="button"
            class="gov_card__ghost_button"
            @click="accountStore.isConnected ? openDelegateDialog() : null"
          >
            {{ shouldUserDelegate ? "Assign delegation" : "Manage delegation" }}
          </button>
        </UiTooltipClick>
      </div>

      <div
        v-if="areDelegatesUnavailable"
        class="brand_note brand_note--warning gov_card__note"
      >
        <Icon
          icon="material-symbols:warning-outline"
          class="brand_note__icon"
        />
        <div class="brand_note__body">
          <div class="brand_note__text">
            Delegates could not be loaded for this network, so this list may be
            incomplete — it does not mean nobody has delegated.
          </div>
        </div>
      </div>

      <FundGovernanceTableTrendingDelegates
        :items="trendingDelegates"
        :active-account-address="fundStore.activeAccountAddress"
        :loading="isFetchingDelegates"
        @row-click="handleRowClick"
      />
    </div>

    <FundGovernanceModalDelegateVotes
      v-model="isDelegateDialogOpen"
      @delegate-success="handleDelegateSuccess"
    />

    <UiConfirmDialog
      v-model="delegatorsDialog"
      title="Delegators"
      confirm-text=""
      cancel-text="Close"
      class="confirm_dialog"
      max-width="800px"
      @cancel="delegatorsDialog = false"
    >
      <div class="mb-10">
        <div class="title">
          Delegated Member:
        </div>
        <AddressLink
          v-if="activeRow?.delegatedMember"
          :address="activeRow?.delegatedMember"
          :chain-id="fundStore?.fund?.chainId"
        />
        <template v-else>
          N/A
        </template>
      </div>
      <div>
        <div class="title">
          Delegators:
        </div>
        <ul>
          <li v-for="delegator in activeRow?.delegators" :key="delegator" class="delegator-item">
            <AddressLink :address="delegator" :chain-id="fundStore?.fund?.chainId" />
            <FundGovernanceProposalStateChip
              v-if="activeRow?.delegatedMember === delegator"
              value="Self Delegated"
            />
          </li>
        </ul>
      </div>
    </UiConfirmDialog>

    <UiConfirmDialog
      v-model="confirmDialog"
      title="Heads Up!"
      confirm-text="Create a New Proposal"
      :cancel-text="
        updateSettingsProposals.length > 1 ? 'Cancel' : 'Go to existing proposal'
      "
      class="confirm_dialog"
      :max-width="updateSettingsProposals.length > 1 ? 'unset' : '600px'"
      @confirm="handleNavigateToCreateProposal"
      @cancel="
        updateSettingsProposals.length > 1 ? null : handleGoToProposal()
      "
    >
      <div class="mb-2">
        There is already an active vault settings proposal. Are you sure you want to create a new one?
      </div>
      <FundGovernanceProposalsTable
        v-if="updateSettingsProposals.length > 1"
        :items="updateSettingsProposals"
        :loading="isFetchingProposals"
        :loading-variant="loadingProposalsVariant"
        style="margin-top: 2rem"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
// components
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { truncateAddress } from "~/composables/addressUtils";
import { ActionState } from "~/types/enums/action_state";
import { DelegatesSource } from "~/types/enums/delegates_source";
import { ProposalState } from "~/types/enums/governance_proposal";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
import { _mapDelegatesToTrendingDelegates } from "~/types/helpers/mappers";
import type ITrendingDelegate from "~/types/trending_delegate";
import AddressLink from "~/components/common/AddressLink.vue";

const router = useRouter();
const accountStore = useAccountStore();
const appSettingsStore = useSettingsStore();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const governanceProposalStore = useGovernanceProposalsStore();

const confirmDialog = ref(false);
const updateSettingsProposals = ref([]) as Ref<IGovernanceProposal[]>;
const { shouldUserDelegate } = storeToRefs(fundStore);

const isSettingsOpen = ref(false);
const isCreateMenuOpen = ref(false);

const closeCreateMenu = () => {
  isCreateMenuOpen.value = false;
};

/**
 * The governor's configuration, in the same six fields and the same
 * label-then-value shape the vault overview shows it in — the two are one
 * click apart, and a reader who has seen one should recognise the other.
 *
 * Durations arrive from the store already spelled out ("≈ 1 day"); the
 * governor counts in blocks, which is not an answer to "how long".
 */
const governanceSettings = computed(() => {
  const fund = fundStore.fund;
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

const governanceProposals = computed(() => {
  const proposals = governanceProposalStore.getProposals(
    fundStore.selectedFundChain,
    fundStore.fundAddress,
  );

  // set updateSettingsProposals to proposals that have updateSettings calldata
  updateSettingsProposals.value = proposals.filter((proposal) => {
    return proposal.calldataTags?.some(
      (calldata) => calldata === ProposalCalldataType.FUND_SETTINGS,
    ) && (
      proposal.state === ProposalState.Active ||
      proposal.state === ProposalState.Pending ||
      proposal.state === ProposalState.Queued
    );
  });

  // Sort the events by createdTimestamp
  proposals.sort((a, b) => {
    const timestampA = a.createdTimestamp;
    const timestampB = b.createdTimestamp;
    return timestampB - timestampA;
  });

  return proposals;
});

const pendingProposals = computed(() => {
  return governanceProposals.value.filter(
    (proposal) => proposal.state === ProposalState.Pending,
  );
});

const proposalsCaption = computed(() => {
  const pending = pendingProposals.value.length;
  const total = governanceProposals.value.length;
  const noun = pending === 1 ? "PENDING PROPOSAL" : "PENDING PROPOSALS";
  return `${pending} ${noun} · ${total} TOTAL`;
});

const hasUpdateSettingsProposal = computed(() => {
  return updateSettingsProposals.value.length > 0;
});

/**
 * How often a proposal that was actually decided got through. Queued counts as
 * a success — it passed and is waiting on the timelock, not on the vote — and
 * Pending ones are left out of both halves, since nothing has been decided
 * about them yet.
 */
const proposalsSuccessRate = computed(() => {
  const decided =
    governanceProposals.value.length - pendingProposals.value.length;
  if (!decided) return "—";

  const succeeded = governanceProposals.value.filter((proposal) =>
    [
      ProposalState.Succeeded,
      ProposalState.Executed,
      ProposalState.Queued,
    ].includes(proposal.state),
  ).length;

  return `${Math.round((succeeded / decided) * 100)}%`;
});

// fetchProposals can be a super long-lasting process, so if the user changes
// page we want to stop fetching proposals.
const shouldFetchProposals = ref(false);
const shouldFetchTrendingDelegates = ref(true);

// trending delegates
const trendingDelegates = computed(() => {
  const delegates = governanceProposalStore.getDelegates(
    fundStore.selectedFundChain,
    fundStore.fundAddress,
  );
  delegates.sort((a, b) => {
    const votingPowerA = Number(a.votingPower.replace(fundStore.fund?.governanceToken.symbol || "", ""));
    const votingPowerB = Number(b.votingPower.replace(fundStore.fund?.governanceToken.symbol || "", ""));
    return votingPowerB - votingPowerA;
  });
  return _mapDelegatesToTrendingDelegates(delegates);
});

const areProposalsUnavailable = computed(
  () =>
    governanceProposalStore.getProposalsSource(
      fundStore.selectedFundChain,
      fundStore.fundAddress,
    ) === DelegatesSource.Unavailable,
);

const areDelegatesUnavailable = computed(
  () =>
    governanceProposalStore.getDelegatesSource(
      fundStore.selectedFundChain,
      fundStore.fundAddress,
    ) === DelegatesSource.Unavailable,
);

const trendingDelegatesCaption = computed(() => {
  if (areDelegatesUnavailable.value) return "UNAVAILABLE";

  const count = trendingDelegates.value.length;
  return `${count} ${count === 1 ? "DELEGATED WALLET" : "DELEGATED WALLETS"}`;
});

const handleRowClick = (item: ITrendingDelegate) => {
  activeRow.value = item;
  delegatorsDialog.value = true;
};

const delegatorsDialog = ref(false);
const activeRow = ref<ITrendingDelegate | null>(null);
type DropdownOption = {
  click: () => void;
  disabled?: boolean;
};

const dropdownOptions: Record<string, DropdownOption> = {
  "Direct execution": {
    click: () => {
      // change route to direct execution
      router.push(
        `/details/${fundStore.selectedFundSlug}/governance/direct-execution`,
      );
    },
  },
  "Delegated permissions": {
    click: () => {
      // change route to delegated permissions
      router.push(
        `/details/${fundStore.selectedFundSlug}/governance/delegated-permissions`,
      );
    },
  },
  "NAV methods": {
    click: () => {
      router.push(`/details/${fundStore.selectedFundSlug}/nav/manage`);
    },
  },
  "Vault settings": {
    click: () => {
      // if fund settings proposal already exist, open up the dialog
      if (hasUpdateSettingsProposal.value) {
        confirmDialog.value = true;
        return;
      }

      handleNavigateToCreateProposal();
    },
  },
};

const handleNavigateToCreateProposal = () => {
  router.push(
    `/details/${fundStore.selectedFundSlug}/governance/fund-settings`,
  );
  confirmDialog.value = false;
};
const handleGoToProposal = () => {
  const { createdBlockNumber, proposalId } = updateSettingsProposals.value[0];

  if (!createdBlockNumber || !proposalId) {
    console.error("No proposalId or createdBlockNumber found");
    return;
  }

  router.push(
    `/details/${fundStore.selectedFundSlug}/governance/proposal/${createdBlockNumber}-${proposalId}`,
  );
};
const createProposalOptions = Object.keys(dropdownOptions).map(
  (key) => {
    return {
      label: key,
      disabled: dropdownOptions[key]?.disabled || false,
    };
  },
);

const selectOption = (option: string) => {
  closeCreateMenu();
  if (dropdownOptions[option]) {
    dropdownOptions[option].click();
  } else {
    console.error("Option not found");
  }
};

const loadingProposalsVariant = ref("append" as "append" | "prepend");

// delegate dialog
const isDelegateDialogOpen = ref(false);

const openDelegateDialog = () => {
  isDelegateDialogOpen.value = true;
};

onMounted(async () => {
  window.scrollTo({ top: 0 });
  await Promise.all([
    governanceProposalStore.fetchGovernanceProposals(),
    governanceProposalStore.fetchDelegates(),
  ]);
});

onBeforeUnmount(() => {
  shouldFetchProposals.value = false;
  shouldFetchTrendingDelegates.value = false;
});

const handleDelegateSuccess = async () => {
  // await 2000ms before fetching
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const isFetchingProposals = computed(() => {
  const actionStates = actionStateStore.getActionState("fetchGovernanceProposalsAction");

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});

const isFetchingDelegates = computed(() => {
  const actionStates = actionStateStore.getActionState("fetchDelegatesAction");

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});
</script>

<style scoped lang="scss">
.page-governance {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

/* The cards draw their own padding per section, so the shell carries none. */
.gov_settings,
.gov_card {
  padding: 0;
}

.gov_settings {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 1.125rem 1.5rem;
    cursor: pointer;
  }

  &__chevron {
    color: $color-steel-blue;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr;
    border-top: 1px solid $color-line;

    @include sm {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Label left, figure right, hairline under each — the overview's grid. */
  &__cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
    padding: 0.875rem 1.5rem;
    border-bottom: 1px solid $color-line;
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    color: $color-steel-blue;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-align: right;
    @include ellipsis;
  }
}

.gov_card {
  &__head {
    display: flex;
    align-items: center;
    gap: 1.125rem;
    flex-wrap: wrap;
    padding: 1.25rem 1.5rem;
  }

  &__head_text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-right: auto;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: $color-white;
  }

  &__caption {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
  }

  /* The card draws its own padding per section, so the note insets itself. */
  &__note {
    margin: 0 1.5rem 1rem;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-end;
  }

  &__stat_value {
    font-family: $font-mono;
    font-size: 15px;
    color: $color-white;
  }

  &__stat_label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  /* Anchored to the button rather than to the card, so the menu opens under it
     wherever the header wraps to. */
  &__create {
    position: relative;
  }

  /**
   * The gap has to land on Vuetify's inner content element — that is the flex
   * container, so a gap on the button itself does nothing and the chevron ends
   * up against the last letter.
   */
  &__create_button :deep(.v-btn__content) {
    gap: 0.5rem;
  }

  &__create_chevron {
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__menu {
    position: absolute;
    top: calc(100% + 0.375rem);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-width: 220px;
    padding: 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    /* The one shadow in the set: a menu floats over the page and has to read
       as being above it rather than punched into it. */
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  }

  &__menu_item {
    padding: 0.5rem 0.625rem;
    border-radius: $default-border-radius;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: $color-moonlight-light;
    }
  }

  &__ghost_button {
    padding: 0.4375rem 0.875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 13px;
    font-weight: 600;
    color: $color-text-irrelevant;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }
}

.confirm_dialog {
  max-width: unset;
}

.delegator-item{
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.title{
  font-weight: 700;
  color: $color-white;
  margin-bottom: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .gov_settings__chevron,
  .gov_card__create_chevron,
  .gov_card__menu_item,
  .gov_card__ghost_button {
    transition: none;
  }
}
</style>
