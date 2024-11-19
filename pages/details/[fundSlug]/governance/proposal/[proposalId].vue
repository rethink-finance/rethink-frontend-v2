<template>
  <div v-if="proposal?.proposalId" class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :proposal="proposal"
      :active-user-vote-submission="activeUserVoteSubmission"
      :loading-proposal-vote-submissions="isLoadingProposal"
      @vote-success="handleVoteSuccess"
    />

    <div class="section-bottom">
      <div class="main_card section-bottom--left">
        <v-tabs v-model="selectedTab" class="section-bottom__tabs">
          <v-tab value="description" class="section-bottom__tab">
            Description
          </v-tab>
          <v-tab value="executableCode" class="section-bottom__tab">
            Executable Code
          </v-tab>
          <v-tab
            value="voteSubmissions"
            class="section-bottom__tab"
          >
            Vote Submissions
          </v-tab>
        </v-tabs>

        <v-card-text class="section-bottom__tab-content position-relative">
          <template v-if="selectedTab === 'description'">
            {{ proposal?.description ?? "" }}
          </template>
          <template v-else-if="selectedTab === 'executableCode'">
            <v-switch
              v-model="showRawCalldatas"
              label="Raw"
              class="section-bottom__show_raw_calldatas_switch"
              color="primary"
              hide-details
            />
            <div v-if="showRawCalldatas">
              <div class="code_block">
                {{ formatCalldata(rawProposalData) }}
              </div>
            </div>
            <template v-else>
              <div
                v-for="(calldata, index) in filteredProposalCalldatasDecoded"
                :key="index"
                class="mb-6"
              >
                <strong class="text-primary">{{ index }}#</strong>
                <div>
                  <strong>Contract:</strong> {{ calldata?.contractName ?? "N/A" }}
                </div>
                <div>
                  <strong>Function:</strong> {{ calldata?.functionName ?? "N/A" }}
                </div>
                <div>
                  <strong>Target:</strong> {{ proposal?.targets?.[index] ?? "N/A" }}
                </div>
                <div>
                  <strong>Value:</strong> {{ proposal?.values?.[index] ?? "N/A" }}
                </div>
                <UiDataRowCard
                  :grow-column1="true"
                  is-expanded
                >
                  <template #title>
                    <div class="d-flex align-center justify-space-between">
                      <div>
                        Calldata
                      </div>
                      <div>
                        <v-switch
                          v-model="toggledRawProposalCalldatas[index]"
                          label="Raw"
                          color="primary"
                          hide-details
                          @click.stop="toggleRawProposalCalldata(index)"
                        />
                      </div>
                    </div>
                  </template>
                  <template #body>
                    <template v-if="!toggledRawProposalCalldatas[index]">
                      <template v-if="calldata?.calldataType === ProposalCalldataType.NAV_UPDATE">
                        <FundNavMethodsTable
                          :methods="allMethods[index]"
                          show-summary-row
                          show-simulated-nav
                          show-base-token-balances
                          idx="[proposalId]"
                        />
                      </template>
                      <template v-else-if="calldata?.calldataType === ProposalCalldataType.FUND_SETTINGS">
                        <!-- Show fund setting UI -->
                        <FundSettingsExecutableCode
                          :calldata-decoded="calldata?.calldataDecoded"
                        />
                      </template>
                      <template v-else>
                        <div class="code_block">
                          <template v-if="calldata?.calldataDecoded">
                            {{ formatCalldata(calldata?.calldataDecoded) }}
                          </template>
                          <template v-else>
                            Calldata could not be decoded. Check raw data.
                          </template>
                        </div>
                      </template>
                    </template>
                    <template v-else>
                      <div class="code_block">
                        {{ calldata?.calldata }}
                      </div>
                    </template>
                  </template>
                </UiDataRowCard>
              </div>
            </template>
          </template>

          <template v-else-if="selectedTab === 'voteSubmissions'">
            <FundGovernanceTableProposalVoteSubmissions
              :items="proposalVoteSubmissions"
              :loading="isLoadingProposal"
            />
          </template>
        </v-card-text>
      </div>

      <div class="section-bottom--right">
        <UiDataRowCard
          title="Outcome"
          class="data_row_card"
          is-expanded
        >
          <template #body>
            <div class="section-bottom__outcome">
              <FundGovernanceProgressInsight
                title="Approval Rate"
                :value="proposal?.approval"
                :format-function="formatPercent"
                subtext="Approval"
                :tooltip-text="`${ proposal.forVotesFormatted } of ${ proposal.totalVotesFormatted }`"
              />
              <FundGovernanceProgressInsight
                title="Participation Rate"
                :value="proposal?.participation"
                :format-function="formatPercent"
                subtext="Support"
                :tooltip-text="`${ proposal.totalVotesFormatted } of ${ proposal.totalSupplyFormatted }`"
              />
            </div>
          </template>
        </UiDataRowCard>
        <UiDataRowCard
          title="Roadmap"
          class="data_row_card"
          is-expanded
        >
          <template #body>
            <FundGovernanceProposalRoadmap
              :proposal="proposal"
            />
          </template>
        </UiDataRowCard>
      </div>
    </div>
  </div>
  <v-progress-circular
    v-else-if="isLoadingProposal"
    class="loading_spinner"
    size="50"
    width="3"
    indeterminate
  />
  <div v-else class="text-center mt-6 align-center">
    Oops, proposal data is not available.
  </div>
</template>

<script setup lang="ts">
import FundSettingsExecutableCode from "./FundSettingsExecutableCode.vue";

import { useActionStateStore } from "~/store/actionState.store";

import { formatPercent } from "~/composables/formatters";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { ActionState } from "~/types/enums/action_state";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const route = useRoute();
const proposalSlug = route.params.proposalId as string;
const [createdBlockNumber, proposalId] = proposalSlug.split("-") as [bigint, string];
const fundSlug = route.params.fundSlug as string;
const showRawCalldatas = ref(false);

const allMethods = ref<INAVMethod[][]>([]);
console.log("proposal", proposalId);
console.log("fundSlug", fundSlug);

const toggledRawProposalCalldatas = ref<Record<number, boolean>>({});

const toggleRawProposalCalldata = (index: number) => {
  toggledRawProposalCalldatas.value[index] = !(toggledRawProposalCalldatas.value[index] ?? false);
}

const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Proposal Details",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance/proposal/${createdBlockNumber}-${proposalId}`,
  },
];


const selectedTab = ref("description");
const governanceProposalStore = useGovernanceProposalsStore();
const actionStateStore = useActionStateStore();
// const proposalFetched = ref(false);
const shouldFetchProposalVoteSubmissions = ref(true);

const proposalVoteSubmissions = computed(() =>
  proposal.value?.voteSubmissions,
);

const activeUserVoteSubmission = computed(() => {
  const activeAddress = fundStore.activeAccountAddress?.toLowerCase();
  return activeAddress ?
    proposalVoteSubmissions.value?.find(
      sub => sub.proposer.toLowerCase() === activeAddress,
    ) :
    undefined;
});

const proposal = computed(():IGovernanceProposal | undefined => {
  // TODO: refetch proposals after user votes (emit event from ProposalSectionTop)
  const proposal = governanceProposalStore.getProposal(web3Store.chainId, fundStore.fund?.address, proposalId);
  if (!proposal) return undefined;

  /**
  if (!proposalFetched.value && proposal?.createdBlockNumber) {
    // Refetch it to update it, maybe it came from local storage.
    governanceProposalStore.fetchBlockProposals(proposal.createdBlockNumber);
    proposalFetched.value = true;
  }
  */

  return proposal;
})

const filteredProposalCalldatasDecoded = computed(() => {
  // TODO: remove this after Contract whitelists are fixed
  // This is done now because we have to submit 2 fund settings to change whitelist,
  // first one just sends the same whitelist as it was to reset it, and the secnod one has new whitelist addresses.

  // first index is a default fund settings just meant to reset the whitelist (sending existing whitelist)
  const firstIndex = proposal.value?.calldataTypes?.indexOf(
    ProposalCalldataType.FUND_SETTINGS,
  ) ?? -1;
  // last index is a final fund settings
  const lastIndex = proposal.value?.calldataTypes?.lastIndexOf(
    ProposalCalldataType.FUND_SETTINGS,
  ) ?? -1;

  const calldatasDecoded = proposal.value?.calldatasDecoded;
  // remove default fund settings from proposal (the one it is resetting the whitelist, no need to show it here, it's a hack)
  if (calldatasDecoded?.length && firstIndex !== lastIndex && firstIndex !== -1) {
    console.debug("removing default fund settings by index", firstIndex);
    return [...calldatasDecoded.slice(0, firstIndex), ...calldatasDecoded.slice(firstIndex + 1)];
  }

  return calldatasDecoded;
})

const parseNavEntries = (calldataDecoded: any): INAVMethod[] => {
  console.log("calldataDecoded", calldataDecoded);
  const navMethods = [];
  for (const [index, navMethod] of (calldataDecoded?.navUpdateData ?? []).entries()) {
    navMethods.push(parseNAVMethod(index, navMethod));
  }
  return navMethods
}

const rawProposalData = computed(() => {
  return {
    targets: proposal.value?.targets ?? [],
    values: proposal.value?.values ?? [],
    signatures: proposal.value?.signatures ?? [],
    calldatas: proposal.value?.calldatas ?? [],
  }
})
watch(
  () => proposal.value, (newProposal: IGovernanceProposal | undefined) => {
    if (!newProposal) return;

    newProposal.calldatas.forEach((_, index) => {
      toggledRawProposalCalldatas.value[index] = false;
    })
  },
  { immediate: true },
);

const formatCalldata = (calldata: any) => {
  try {
    return JSON.stringify(calldata, null, 2)
  } catch {
    console.warn("failed to format calldata", calldata);
    return calldata;
  }
}
/**
const fetchProposalVoteSubmissions = async () => {
  loadingProposalVoteSubmissions.value = true;
  try {
    const currentBlock = Number(await fundStore.web3.eth.getBlockNumber());
    const proposalBlock = proposal.value?.createdBlockNumber ?? 0;
    const proposalId = proposal.value?.proposalId ?? "";

    let fromBlock = BigInt(currentBlock);
    const endBlock = BigInt(proposalBlock);
    let chunkSize = 1000n;
    const minChunkSize = 1000n;
    let waitTimeAfterError = 1000;

    while (fromBlock > endBlock && shouldFetchProposalVoteSubmissions.value) {
      let toBlock = fromBlock - chunkSize + 1n;

      if (toBlock < endBlock) {
        toBlock = endBlock;
      }

      console.debug("VS - chunkSize: ", chunkSize);
      console.debug("VS - Fetching events from: ", fromBlock, " to: ", toBlock);

      try {
        const eventsVS = await fundStore.fundGovernorContract.getPastEvents("VoteCast", {
          fromBlock: Number(toBlock),
          toBlock: Number(fromBlock),
        });

        // sort new chunk of events by block number
        const sortedEventsVS = eventsVS.sort(
          (a:any, b:any) => Number(a.blockNumber) - Number(b.blockNumber),
        ).filter((event:any) => {
          // filter events by proposalId
          return (
            Number(event?.returnValues?.proposalId) === Number(proposalId)
          );
        });

        console.debug("VS - eventsVS: ", eventsVS);

        // append new events to the existing list of proposalVoteSubmissions
        for (const event of sortedEventsVS) {
          const { voter, support, weight } = event?.returnValues; // reason is not used

          // fetch block details to get the timestamp
          const blockVoteCast = await fundStore.web3.eth.getBlock( event?.blockNumber);
          const voteTimestamp = blockVoteCast?.timestamp ? new Date(Number(blockVoteCast?.timestamp) * 1000) : null;
          const myVote = fundStore?.activeAccountAddress?.toLowerCase() === voter?.toLowerCase();

          const newVote = {
            proposalId,
            proposer: voter,
            my_vote: myVote,
            submission_status: VoteTypeMapping[Number(support) as keyof typeof VoteTypeMapping],
            quorumVotes:
              formatTokenValue(
                weight,
                fundStore?.fund?.governanceToken.decimals,
                false,
                true,
              ) + " " + fundStore.fund?.governanceToken.symbol,
            date: voteTimestamp ? formatDateToLocaleString(voteTimestamp, false) : "N/A",
          }

          // append new submission to proposalVoteSubmissions
          proposalVoteSubmissions.value.push(newVote);

          if (myVote) {
            activeUserVoteSubmission.value = newVote;
          }
        }

        console.debug("VS - proposalVoteSubmissions: ", proposalVoteSubmissions.value);

        // double the chunk size
        chunkSize *= 2n;
        console.debug("VS - chunkSize doubled: ", chunkSize);
        waitTimeAfterError = Math.max(100, waitTimeAfterError / 2);

        fromBlock = toBlock - 1n; // prepare for next block chunk

        await new Promise((resolve) => setTimeout(resolve, waitTimeAfterError));
      } catch (error) {
        console.error("Error fetching proposals votes submissions", error);
        // if fetching fails, reduce the chunk size
        chunkSize /= 2n;
        if (chunkSize < minChunkSize) {
          chunkSize = minChunkSize;
        }

        console.debug("VS - chunkSize reduced: ", chunkSize);
        waitTimeAfterError = Math.min(10000, waitTimeAfterError * 2);

        await new Promise((resolve) => setTimeout(resolve, waitTimeAfterError));
      }
    }

    loadingProposalVoteSubmissions.value = false;
    console.debug("All VoteCast events fetched");
  } catch (e: any) {
    console.error("Error fetching proposals votes submissions", e);
    loadingProposalVoteSubmissions.value = false;
  }
};
 */
// when the user vote, refetch the votes submissions
const handleVoteSuccess = async () => {
  shouldFetchProposalVoteSubmissions.value = true;
  // await 2000ms before fetching
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await governanceProposalStore.fetchGovernanceProposal(proposalId);
  // fetchProposalVoteSubmissions();
}

onMounted(async () => {
  // fetchProposalVoteSubmissions();
  emit("updateBreadcrumbs", breadcrumbItems);

  // fetch block proposals based on createdBlockNumber
  try {
    await governanceProposalStore.fetchGovernanceProposal(proposalId);

    // await governanceProposalStore.fetchBlockProposals(createdBlockNumber);

    if (proposal.value && !proposal.value?.executedBlockNumber) {
      // await governanceProposalStore.proposalExecutedBlockNumber(proposal.value);
    }
  } catch {}

  if (proposal.value) {
    allMethods.value = proposal.value?.calldatasDecoded?.map((calldata) => {
      return parseNavEntries(calldata?.calldataDecoded);
    }) ?? [];
  }
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
  shouldFetchProposalVoteSubmissions.value = false;
});

const isLoadingProposal = computed(() => {
  const actionStates = actionStateStore.getActionState(
    "fetchGovernanceProposalAction",
  );

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});
</script>

<style scoped lang="scss">
// overrides for expansion-panel
.data_row_card {
  margin-bottom: 1rem;

  :deep(.data_row__title) {
    font-size: 16px;
    font-weight: 700;
    line-height: 24px;
  }
  // remove outer border
  :deep(.data_row__panel) {
    border: 0;
    border-radius: 0.25rem !important;
    background-color: rgb(var(--v-theme-surface));
  }
  // add more spacing to content inside
  :deep(.v-expansion-panel-text__wrapper) {
    padding-bottom: 1rem !important;
  }
  // add borders to text fields inside panel
  :deep(.v-expansion-panels) {
    border: 1px solid $color-gray-transparent;
    border-radius: 0.25rem !important;

    .data_row__panel {
      padding: 0;
    }
  }
}

.section-bottom {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  justify-content: space-between;
  align-items: flex-start;

  &--right,
  &--left {
    width: 100%;
  }

  &--right {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  &__roadmap {
    padding: 1rem;
  }

  &__outcome {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  // tabs override
  &__tabs {
    margin-bottom: 1rem;
    :deep(.v-slide-group__content) {
      justify-content: space-between;
    }
    :deep(.v-tab.v-btn) {
      font-size: 1rem;
      font-weight: 500;

      @include borderGray;
    }
    :deep(.v-tab__slider) {
      display: none;
    }
    :deep(.v-btn__content) {
      color: $color-steel-blue;
    }

    // selected tab styles
    :deep(.v-tab--selected) {
      color: $color-primary;
      background-color: $color-gray-light-transparent;
    }
    :deep(.v-tab--selected .v-btn__content) {
      color: $color-primary;
    }
  }

  &__tab-content {
    padding: 1rem;
    position: relative;
    @include borderGray;

    background-color: $color-gray-light-transparent;

    font-size: 1rem;
    font-weight: 400;
    color: $color-text-irrelevant;
    white-space: break-spaces;
    overflow-wrap: break-word;
  }
  &__show_raw_calldatas_switch {
    position: absolute;
    right: 1rem;
  }

  // Breakpoints
  @include md {
    flex-direction: row;

    &--left {
      width: 75%;
    }

    &--right {
      width: 25%;
    }
  }
}
.loading_spinner {
  display: flex;
  margin: 50px auto 0;
}
</style>
