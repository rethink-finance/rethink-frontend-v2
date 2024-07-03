<template>
  <div class="section-top">
    <h2 class="section-top__title">
      {{ proposal.title }}
    </h2>

    <div class="section-top__meta-container">
      <div class="section-top__meta">
        <div class="section-top__meta-row">
          <FundGovernanceProposalStateChip
            :value="proposal.state"
            class="section-top__tag"
          />
          <FundGovernanceProposalStateChip
            value="Permissions"
            class="section-top__tag"
          />
          <!--          <div class="section-top__submission">-->
          <!--            <Icon-->
          <!--              :icon="icons[submission as keyof typeof icons]"-->
          <!--              width="0.9rem"-->
          <!--              class="section-top__submission-icon"-->
          <!--            />-->
          <!--            <div class="section-top__submission-text">-->
          <!--              {{ submission }}-->
          <!--            </div>-->
          <!--          </div>-->
        </div>

        <div class="section-top__meta-row">
          <div
            v-for="item in metaCopyTags"
            :key="item.label"
            class="section-top__meta-item"
          >
            <div class="meta-label">
              {{ item.label }} {{ item?.format?.(item.value) ?? item.value }}
            </div>
            <ui-tooltip-click :tooltip-text="`Copied to clipboard: ${item.value}`">
              <Icon
                icon="clarity:copy-line"
                class="section-top__copy-icon"
                width="0.8rem"
                @click="copyText(item.value)"
              />
            </ui-tooltip-click>
          </div>
        </div>
      </div>

      <v-btn
        v-if="isSubmitButtonVisible"
        class="section-top__submit-button"
        @click="submitButtonClick"
      >
        {{ submitButtonText }}
      </v-btn>


      <v-dialog
        v-model="isDialogOpen"
        scrim="black"
        opacity="0.25"
        max-width="500"
      >
        <div class="main_card di-card">
          <div class="di-card__header-container">
            <div class="di-card__header">
              Vote Submission
            </div>

            <Icon
              :icon="VoteTypeIcon[VoteType.Against]"
              class="di-card__close-icon"
              width="1.5rem"
              @click="dialogClose"
            />
          </div>

          <div
            v-for="item in metaCopyTags.slice(0, 1)"
            :key="item.label"
            class="di-card__subtext"
          >
            <div class="meta-label">
              {{ item.label }} {{ item?.format?.(item.value) ?? item.value }}
            </div>
            <ui-tooltip-click tooltip-text="Copied">
              <Icon
                icon="clarity:copy-line"
                class="section-top__copy-icon"
                width="0.8rem"
                @click="copyText(item.value)"
              />
            </ui-tooltip-click>
          </div>

          <h2 class="di-card__title">
            {{ proposal.title }}
          </h2>

          <div class="di-card__voting-power meta-label meta-label--uppercase">
            Voting Power: N/A (TODO)
          </div>

          <v-radio-group v-model="selectedVoteOption" class="di-card__radio-group">
            <v-radio
              v-for="option in voteOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              class="di-card__radio"
            >
              <template #label>
                <Icon
                  :icon="option.icon"
                  width="1.4rem"
                  :class="voteOptionIcon(option.value)"
                />
                {{ option.label }}
              </template>
            </v-radio>
          </v-radio-group>

          <v-btn
            class="di-card__submit-button"
            :disabled="!selectedVoteOption"
            :loading="loadingSubmitVote"
            @click="submitVote"
          >
            Submit Vote
          </v-btn>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
// toast
import { truncateAddress } from "~/composables/addressUtils";
// import { useToastStore } from "~/store/toast.store";
import type IGovernanceProposal from "~/types/governance_proposal";
import {
  ProposalState,
  VoteType,
  VoteTypeClass, VoteTypeIcon,
  VoteTypeMapping,
  VoteTypeNumberMapping,
} from "~/types/enums/governance_proposal";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

const props = defineProps({
  proposal: {
    type: Object as PropType<IGovernanceProposal>,
    default: () => {},
  },
});

const fundStore = useFundStore();
const toastStore = useToastStore();
const loadingSubmitVote = ref(false);

interface IMetaItem {
  label: string;
  value: string;
  format?: (value: string) => string;
}

const voteOptions: { label: string; value: number; icon: string }[] = [
  { label: VoteType.For, value: VoteTypeNumberMapping[VoteType.For], icon: VoteTypeIcon[VoteType.For] },
  { label: VoteType.Against, value: VoteTypeNumberMapping[VoteType.Against], icon: VoteTypeIcon[VoteType.Against] },
  { label: VoteType.Abstain, value: VoteTypeNumberMapping[VoteType.Abstain], icon: VoteTypeIcon[VoteType.Abstain] },
];
const metaCopyTags = computed((): IMetaItem[] => {
  return [
    {
      label: "Proposal ID:",
      value: props.proposal.proposalId,
    },
    {
      label: "Proposer",
      value: props.proposal.proposer,
      format: truncateAddress,
    },
  ];
});

const isSubmitButtonVisible = computed(() => {
  // On active state user can vote, and on succeeded it can be exceuted.
  return [ProposalState.Active, ProposalState.Succeeded].includes(props.proposal.state);
});

const hasProposalSucceeded = computed(() => {
  return props.proposal.state === ProposalState.Succeeded;
});
const hasProposalExecuted = computed(() => {
  return props.proposal.state === ProposalState.Executed;
});

const submitButtonText = computed(() => {
  if (hasProposalSucceeded.value) return "Execute Proposal"
  if (hasProposalExecuted.value) return "N/A"
  return "Submit Vote";
});

const isDialogOpen = ref(false);
const selectedVoteOption = ref<number>();
const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
}
const submitButtonClick = () => {
  // if proposal is approved, execute proposal
  if (hasProposalSucceeded.value) {
    executeProposal();
  } else {
  // if proposal is not approved, open dialog
  // for submission
    dialogOpen();
  }
}

const submitVote = () => {
  loadingSubmitVote.value = true;
  console.log("cast vote", props.proposal.proposalId, selectedVoteOption.value)

  fundStore.fundGovernorContract.methods.castVote(props.proposal.proposalId, selectedVoteOption.value).send(
    {
      from: fundStore.activeAccountAddress,
    },
  ).on("transactionHash", (hash: string) => {
    console.log("tx hash: " + hash);
    toastStore.addToast("Your vote has been submitted. Please wait for it to be confirmed.");
  }).on("receipt", (receipt: any) => {
    console.log("receipt: ", receipt);
    if (receipt.status) {
      toastStore.successToast("Vote successful.");
    } else {
      toastStore.errorToast(
        "The vote transaction has failed. Please contact the Rethink Finance support.",
      );
    }
    loadingSubmitVote.value = false;
    dialogClose();
  }).on("error", (error: any) => {
    console.error(error);
    loadingSubmitVote.value = false;
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    dialogClose();
  });
  // toastStore.successToast(msg[selectedVoteOption]);
}

const executeProposal = () => {
  alert("Execute Proposal");
}
const dialogOpen = () => {
  isDialogOpen.value = true;
}
const dialogClose = () => {
  isDialogOpen.value = false;
}

const voteOptionIcon = (voteType: number) => {
  return [
    "di-card__radio",
    { [`di-card__radio--${VoteTypeClass[VoteTypeMapping[voteType]]}`]: voteType === selectedVoteOption.value },
  ];
}
</script>

<style scoped lang="scss">
.section-top {
  margin-bottom: 3rem;

  &__title {
    margin-bottom: 1.5rem;
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  &__meta-container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.5rem;

    @include sm {
      flex-direction: row;
      gap: 1rem;
    }
  }

  &__meta {
    width: 100%;

    @include sm {
      width: 75%;
    }
  }

  &__meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  &__copy-icon {
    cursor: pointer;
    rotate: 180deg;
    transform: scaleX(-1);
    color: $color-steel-blue;
  }

  &__submission {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    color: $color-white;

    &-text {
      font-size: 0.8rem;
    }

    &-icon {
      width: 0.9rem;
    }
  }

  &__submit-button {
    cursor: pointer;
  }
}

.meta-label {
  display: inline;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: $color-steel-blue;

  &--uppercase {
    text-transform: uppercase;
  }
}

.di-card {
  @include borderGray;
  margin: 0 auto;
  color: white;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__header,
  &__title {
    font-size: $text-lg;
    font-weight: 700;
  }

  &__subtext {
    display: flex;
    align-items: center;
    gap: 0.15rem;

    margin-bottom: 1rem;
    color: $color-steel-blue;
  }

  &__title {
    margin-bottom: 1rem;
  }

  &__voting-power {
    display: block;
    margin-bottom: 0.5rem;
  }

  &__close-icon {
    cursor: pointer;
    color: $color-steel-blue;
  }

  &__submit-button {
    width: 100%;
  }

  // overrides for radio group
  &__radio-group {
    margin-bottom: 1.5rem;

    :deep(.v-selection-control-group) {
      gap: 1rem;
    }
    :deep(.v-selection-control) {
      flex-direction: row-reverse;
      justify-content: space-between;

      padding: 0.25rem 0.5rem;
      color: $color-white;

      @include borderGray;
    }
    :deep(.v-label) {
      opacity: 1;
      width: 100%;
      gap: 0.5rem;
    }
  }
  // color for icons
  &__radio {
    &--for {
      color: $color-success;
    }
    &--against {
      color: $color-error;
    }
    &--abstain {
      color: $color-warning;
    }
  }
}
</style>
