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
            v-for="(calldataTag, index) of proposal.calldataTags ?? []"
            :key="index"
            :value="calldataTag"
            class="section-top__tag"
          />
        </div>

        <!-- TODO: move this into component that will show status, date, voting power -->
        <div
          v-if="
            loadingProposalVoteSubmissions || activeUserVoteSubmission?.proposer
          "
          class="section-top__meta-row vote_submission"
        >
          Your Vote:
          <v-progress-circular
            v-if="
              loadingProposalVoteSubmissions &&
                !activeUserVoteSubmission?.proposer
            "
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <div
            v-else-if="activeUserVoteSubmission?.proposer"
            class="vote_submission"
          >
            <Icon
              :icon="
                VoteTypeIcon[
                  activeUserVoteSubmission.submission_status as VoteType
                ]
              "
              width="1.4rem"
              :class="`icon--${VoteTypeClass[activeUserVoteSubmission.submission_status as VoteType]}`"
            />
            <div class="vote_submission__text">
              {{ activeUserVoteSubmission?.submission_status }}
            </div>
          </div>
        </div>
        <div v-else class="section-top__meta-row vote_submission">
          You have not voted on this proposal.
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
            <ui-tooltip-click :hide-after="4000">
              <Icon
                icon="clarity:copy-line"
                class="section-top__copy-icon"
                width="0.8rem"
                @click="copyText(item.value)"
              />

              <template #tooltip>
                <div class="tooltip__content">
                  <span>Copied to clipboard</span>
                </div>
              </template>
            </ui-tooltip-click>
          </div>
        </div>
      </div>

      <div class="buttons-container">
        <v-progress-circular
          v-if="loadingProposalVoteSubmissions"
          class="vote_submission"
          size="35"
          width="2"
          indeterminate
        />

        <template v-else>
          <v-btn
            v-if="isProposalActive && !hasAccountVotedAlready"
            class="section-top__submit-button"
            :disabled="!accountStore.isConnected"
            @click="openVoteDialog"
          >
            Submit Vote
            <v-tooltip
              v-if="!accountStore.isConnected || hasAccountVotedAlready"
              :model-value="true"
              activator="parent"
              location="top"
              @update:model-value="false"
            >
              <template v-if="!accountStore.isConnected">
                Connect your wallet.
              </template>
            </v-tooltip>
          </v-btn>
          <UiNotification
            v-else-if="hasAccountVotedAlready && isProposalActive"
            class="notification"
          >
            You have voted on this proposal.
          </UiNotification>

          <v-btn
            v-if="hasProposalSucceeded && !hasProposalExecuted"
            class="section-top__submit-button"
            :loading="loadingExecuteProposal"
            :disabled="!accountStore.isConnected"
            @click="executeProposal"
          >
            Execute Proposal
            <v-tooltip
              v-if="!accountStore.isConnected"
              :model-value="true"
              activator="parent"
              location="top"
              @update:model-value="false"
            >
              <template v-if="!accountStore.isConnected">
                Connect your wallet.
              </template>
            </v-tooltip>
          </v-btn>
        </template>
      </div>

      <v-dialog
        v-model="isVoteDialogOpen"
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
              @click="closeVoteDialog"
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

          <v-radio-group
            v-model="selectedVoteOption"
            class="di-card__radio-group"
          >
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
            :disabled="selectedVoteOption === -1"
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
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  ProposalState,
  VoteType,
  VoteTypeClass,
  VoteTypeIcon,
  VoteTypeMapping,
  VoteTypeNumberMapping,
} from "~/types/enums/governance_proposal";
import type IGovernanceProposal from "~/types/governance_proposal";
import type IProposalVoteSubmission from "~/types/vote_submission";

const emit = defineEmits(["vote-success"]);

const props = defineProps({
  proposal: {
    type: Object as PropType<IGovernanceProposal>,
    default: () => {},
  },
  activeUserVoteSubmission: {
    type: Object as PropType<IProposalVoteSubmission> | undefined,
    default: () => {},
  },
  loadingProposalVoteSubmissions: {
    type: Boolean,
    default: false,
  },
});
const web3Store = useWeb3Store();
const fundStore = useFundStore();
const toastStore = useToastStore();
const accountStore = useAccountStore();
const governanceProposalStore = useGovernanceProposalsStore();
const loadingSubmitVote = ref(false);
const loadingExecuteProposal = ref(false);

interface IMetaItem {
  label: string;
  value: string;
  format?: (value: string) => string;
}

const voteOptions: { label: string; value: number; icon: string }[] = [
  {
    label: VoteType.For,
    value: VoteTypeNumberMapping[VoteType.For],
    icon: VoteTypeIcon[VoteType.For],
  },
  {
    label: VoteType.Against,
    value: VoteTypeNumberMapping[VoteType.Against],
    icon: VoteTypeIcon[VoteType.Against],
  },
  {
    label: VoteType.Abstain,
    value: VoteTypeNumberMapping[VoteType.Abstain],
    icon: VoteTypeIcon[VoteType.Abstain],
  },
];
const metaCopyTags = computed((): IMetaItem[] => {
  return [
    {
      label: "Proposal ID:",
      value: props.proposal.proposalId,
      format: truncateAddress,
    },
    {
      label: "Proposer",
      value: props.proposal.proposer,
      format: truncateAddress,
    },
  ];
});

const isProposalActive = computed(() => {
  return props.proposal?.state === ProposalState.Active;
});

const hasProposalSucceeded = computed(() => {
  return props.proposal.state === ProposalState.Succeeded;
});
const hasProposalExecuted = computed(() => {
  return props.proposal.state === ProposalState.Executed;
});

const hasAccountVotedAlready = computed(() => {
  return (
    governanceProposalStore.hasAccountVoted(props.proposal.proposalId) ?? false
  );
});

const isVoteDialogOpen = ref(false);
const selectedVoteOption = ref<number>(-1);
const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
};

const submitVote = async () => {
  loadingSubmitVote.value = true;
  console.log("cast vote", props.proposal.proposalId, selectedVoteOption.value);
  try {
    await fundStore.fundGovernorContract
      .send("castVote", {}, props.proposal.proposalId, selectedVoteOption.value)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Your vote has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Vote successful.");

          // update has voted
          if (
            fundStore.activeAccountAddress !== undefined &&
            props.proposal.proposalId
          ) {
            governanceProposalStore.connectedAccountProposalsHasVoted[
              props.proposal.proposalId
            ] ??= {};
            governanceProposalStore.connectedAccountProposalsHasVoted[
              props.proposal.proposalId
            ][fundStore.activeAccountAddress] = true;
          }
          // emit success event to refetch vote submissions
          emit("vote-success", selectedVoteOption.value);
        } else {
          toastStore.errorToast(
            "The vote transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingSubmitVote.value = false;
        closeVoteDialog();
      })
      .on("error", (error: any) => {
        console.error(error);
        loadingSubmitVote.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
        closeVoteDialog();
      });
  } catch {
    loadingSubmitVote.value = false;
  }
};

const executeProposal = async () => {
  loadingExecuteProposal.value = true;
  console.log(
    "execute Data:",
    JSON.stringify(
      [
        props.proposal.targets,
        props.proposal.values,
        props.proposal.calldatas,
        props.proposal.descriptionHash,
      ],
      null,
      2,
    ),
  );

  const trxData = [
    props.proposal.targets,
    props.proposal.values,
    props.proposal.calldatas,
    props.proposal.descriptionHash,
  ];

  try {
    await fundStore.fundGovernorContract
      .send("execute", {}, ...trxData)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Proposal execution has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Proposal execution successful.");
        } else {
          toastStore.errorToast(
            "Proposal execution transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingExecuteProposal.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        loadingExecuteProposal.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    console.error("Error here proposal: ", error);
    loadingExecuteProposal.value = false;
  }
};
const openVoteDialog = () => {
  isVoteDialogOpen.value = true;
};
const closeVoteDialog = () => {
  isVoteDialogOpen.value = false;
};

const voteOptionIcon = (voteType: number) => {
  return [
    "di-card__radio",
    {
      [`di-card__radio--${VoteTypeClass[VoteTypeMapping[voteType]]}`]:
        voteType === selectedVoteOption.value,
    },
  ];
};

const fetchHasVoted = () => {
  const fundChainId = fundStore.fundChainId;
  if (
    fundStore.activeAccountAddress === undefined ||
    !props.proposal.proposalId
  ) {
    return;
  }
  props.proposal.hasVotedLoading = true;

  const activeAccountAddress = fundStore.activeAccountAddress;
  governanceProposalStore.connectedAccountProposalsHasVoted[
    props.proposal.proposalId
  ] ??= {};

  web3Store
    .callWithRetry(
      fundChainId,
      () =>
        fundStore.fundGovernorContract.methods
          .hasVoted(props.proposal.proposalId, activeAccountAddress)
          .call(),
    )
    .then((hasVoted: boolean) => {
      governanceProposalStore.connectedAccountProposalsHasVoted[
        props.proposal.proposalId
      ][activeAccountAddress] = hasVoted;
    })
    .finally(() => {
      props.proposal.hasVotedLoading = false;
    });
};

watch(
  () => props.proposal.proposalId,
  (newProposalId) => {
    fetchHasVoted();
  },
  { immediate: true },
);

onMounted(() => {
  fetchHasVoted();
});
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
  width: 100%;

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

.vote_submission {
  display: flex;
  align-items: center;
  color: $color-steel-blue;
  gap: 0.25rem !important;
}
.icon {
  &--abstain {
    color: $color-warning;
  }
  &--against {
    color: $color-error;
  }
  &--for {
    color: $color-success;
  }
}

.buttons-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
}
.notification {
  margin: 0;
}
</style>
