<template>
  <div v-if="proposal?.proposalId" class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :proposal="proposal"
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
            Votes Submissions
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
                v-for="(calldata, index) in proposal.calldatasDecoded"
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
                      <template v-if="proposal?.calldataTypes[index] === ProposalCalldataType.NAV_UPDATE">
                        <FundNavMethodsTable
                          :methods="allMethods[index]"
                          show-summary-row
                          show-simulated-nav
                          show-base-token-balances
                          idx="[proposalId]"
                        />
                      </template>
                      <template v-else-if="proposal?.calldataTypes[index] === ProposalCalldataType.FUND_SETTINGS">
                        <!-- Show fund setting UI -->
                        <FundSettingsExecutableCode
                          :calldata-decoded="proposal?.calldatasDecoded?.[index]?.calldataDecoded"
                        />
                      </template>
                      <template v-else>
                        <div class="code_block">
                          {{ formatCalldata(calldata?.calldataDecoded) }}
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
            <FundGovernanceTableProposalsVotesSubmissions
              :items="proposalsVotesSubmissions"
              :loading="false"
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
                :tooltip-text="`${ proposal.forVotesFormatted } of ${ proposal.quorumVotesFormatted }`"
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
    v-else-if="loadingProposal"
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
import { formatPercent } from "~/composables/formatters";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance_proposals.store";
import { useWeb3Store } from "~/store/web3.store";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
import type INAVMethod from "~/types/nav_method";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const web3Store = useWeb3Store();
const fundStore = useFundStore();
const route = useRoute();
const proposalSlug = route.params.proposalId as string;
const [createdBlockNumber, proposalId] = proposalSlug.split("-") as [bigint, string];
const fundSlug = route.params.fundSlug as string;
const showRawCalldatas = ref(false);
const loadingProposal = ref(false);
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

const proposalsVotesSubmissions: Partial<IGovernanceProposal>[] = [
  {
    proposalId: "75jfh475hqc",
    proposer: "0x1f98dgfgF984",
    // submission_status: "Abstained", // TODO fix
    quorumVotes: BigInt(2500000),
  },
  {
    proposalId: "75jfh475hqc",
    proposer: "0x1f98dgfgF984",
    // submission_status: "Abstained", // TODO fix
    quorumVotes: BigInt(150000),
  },
  {
    proposalId: "75jfh475hqc",
    proposer: "0x1f98dgfgF984",
    // submission_status: "Abstained", // TODO fix
    quorumVotes: BigInt(800000),
  },
];

const selectedTab = ref("description");
const governanceProposalStore = useGovernanceProposalsStore();
const proposalFetched = ref(false);

const proposal = computed(():IGovernanceProposal | undefined => {
  const proposal = governanceProposalStore.getProposal(web3Store.chainId, fundStore.fund?.address, proposalId);

  if (!proposalFetched.value && proposal?.createdBlockNumber) {
    // Refetch it to update it, maybe it came from local storage.
    governanceProposalStore.fetchBlockProposals(proposal.createdBlockNumber);
    proposalFetched.value = true;
  }

  // TODO: remove this after BE whitelists are fixed
  // first index is a default fund settings
  const firstIndex = proposal?.calldataTypes?.indexOf(
    ProposalCalldataType.FUND_SETTINGS,
  ) ?? -1;
  // last index is a final fund settings
  const lastIndex = proposal?.calldataTypes?.lastIndexOf(
    ProposalCalldataType.FUND_SETTINGS,
  ) ?? -1;

  console.log("firstIndex", firstIndex);
  console.log("lastIndex", lastIndex);

  // remove default fund settings from proposal
  if (firstIndex !== lastIndex && firstIndex !== -1) {
    console.log("removing default fund settings");
    proposal?.targets?.splice(firstIndex, 1);
    proposal?.values?.splice(firstIndex, 1);
    proposal?.signatures?.splice(firstIndex, 1);
    proposal?.calldatas?.splice(firstIndex, 1);
    proposal?.calldatasDecoded?.splice(firstIndex, 1);
  }

  return proposal;
})

const parseNavEntries = (calldataDecoded: any): INAVMethod[] => {
  console.log("calldataDecoded", calldataDecoded);
  const navMethods = [];
  for (const [index, navMethod] of (calldataDecoded?.navUpdateData ?? []).entries()) {
    navMethods.push(fundStore.parseNAVMethod(index, navMethod));
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
    console.warn("failed");
    return calldata;
  }
}

onMounted(async () => {
  emit("updateBreadcrumbs", breadcrumbItems);

  // fetch block proposals based on createdBlockNumber
  loadingProposal.value = true;
  try {
    await governanceProposalStore.fetchBlockProposals(createdBlockNumber);

    if(proposal.value && !proposal.value?.executedBlockNumber) {
      await governanceProposalStore.proposalExecutedBlockNumber(proposal.value);
    }
  } catch {}
  loadingProposal.value = false;

  if (proposal.value) {
    allMethods.value = proposal.value?.calldatasDecoded?.map((calldata) => {
      return parseNavEntries(calldata?.calldataDecoded);
    }) ?? [];
  }
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
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
