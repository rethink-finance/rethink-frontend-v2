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

        <v-card-text class="section-bottom__tab-content">
          <template v-if="selectedTab === 'description'">
            {{ proposal?.description ?? "" }}
          </template>
          <template v-else-if="selectedTab === 'executableCode'">
            <div
              v-for="(calldata, index) in proposal.calldatasDecoded"
              :key="index"
              class="mb-6"
            >
              <strong class="text-primary">{{ index }}#</strong>
              <div>
                <strong>Contract:</strong> {{ calldata.contractName ?? "N/A" }}
              </div>
              <div>
                <strong>Function:</strong> {{ calldata.functionName ?? "N/A" }}
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
                        v-model="decodedProposalCalldatas[index]"
                        label="Decode"
                        color="primary"
                        hide-details
                        :true-value="undefined"
                        @click.stop="toggleProposalCalldataUndecoded(index)"
                      />
                    </div>
                  </div>
                </template>
                <template #body>
                  <div class="code_block">
                    <template v-if="decodedProposalCalldatas[index]">
                      {{ formatCalldata(calldata?.decodedCalldata) }}
                    </template>
                    <template v-else>
                      {{ calldata?.calldata }}
                    </template>
                  </div>
                </template>
              </UiDataRowCard>
            </div>
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
          <!-- TODO: check how to set default-active state for accordion/expansion card -->
          <template #body>
            <div class="section-bottom__outcome">
              <FundGovernanceProgressInsight
                title="Approval Rate"
                :progress="proposal?.approval"
                subtext="Approval"
              />
              <FundGovernanceProgressInsight
                title="Participation Rate"
                :progress="proposal.participation"
                subtext="Support"
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
  <div v-else class="text-center mt-6 align-center">
    Oops, proposal data is not available.
  </div>
</template>

<script setup lang="ts">
import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance_proposals.store";
import { useWeb3Store } from "~/store/web3.store";
import type IGovernanceProposal from "~/types/governance_proposal";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const web3Store = useWeb3Store();
const fundStore = useFundStore();
const route = useRoute();
const proposalId = route.params.proposalId as string;
const fundSlug = route.params.fundSlug as string;
console.log("proposal", proposalId);
console.log("fundSlug", fundSlug);

const decodedProposalCalldatas = ref<Record<string, boolean>>({});

const toggleProposalCalldataUndecoded = (index: string) => {
  decodedProposalCalldatas.value[index] = !(decodedProposalCalldatas.value[index] ?? false);
}

const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "All Proposals",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Proposal Details",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance`,
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
  return proposal;
})
watch(
  () => proposal.value, (newProposal: IGovernanceProposal | undefined) => {
    if (!newProposal) return;

    newProposal.calldatas.forEach((_, index) => {
      decodedProposalCalldatas.value[index] = true;
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

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
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
    @include borderGray;

    background-color: $color-gray-light-transparent;

    font-size: 1rem;
    font-weight: 400;
    color: $color-text-irrelevant;
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
</style>
