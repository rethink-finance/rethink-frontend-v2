<template>
  <div v-if="proposal?.proposalId" class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :proposal="proposal"
    />

    <div class="section-bottom">
      <div class="main_card section-bottom--left">
        <v-tabs v-model="selectedTab.tab" class="section-bottom__tabs">
          <v-tab value="one" class="section-bottom__tab">
            Description
          </v-tab>
          <v-tab value="two" class="section-bottom__tab">
            Executable Code
          </v-tab>
          <v-tab
            value="three"
            class="section-bottom__tab"
          >Votes Submissions</v-tab>
        </v-tabs>

        <v-card-text class="section-bottom__tab-content">
          <div v-if="selectedTab.tab === 'one'" v-html="tabsContent.one" />
          <div v-else-if="selectedTab.tab === 'two'" v-html="tabsContent.two" />
          <div v-else-if="selectedTab.tab === 'three'">
            <FundGovernanceTableProposalsVotesSubmissions
              :items="proposalsVotesSubmissions"
              :loading="false"
            />
          </div>
        </v-card-text>
      </div>

      <div class="section-bottom--right">
        <UiDataRowCard title="Outcome" class="data_row_card">
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
        <UiDataRowCard title="Roadmap" class="data_row_card">
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

const selectedTab = reactive({
  tab: "one",
});

const tabsContent: Record<string, any> = {
  one: "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Iste vel harum explicabo veritatis officia quam quibusdam illum aut sunt! Consequatur placeat id vero porro? Accusamus similique excepturi odio voluptatibus perspiciatis, porro possimus omnis non facilis? Porro eum eaque dolor debitis, quibusdam quas, modi iusto pariatur facere aperiam dolorem rem optio ad nisi repudiandae veritatis, quia accusamus quaerat excepturi cum! Officiis asperiores sint eius totam culpa quia",
  two: "Tab Two",
};

const governanceProposalStore = useGovernanceProposalsStore();
const proposal = computed(() => {
  return governanceProposalStore.getProposal(web3Store.chainId, fundStore.fund?.address, proposalId);
})

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
};
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