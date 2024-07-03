<template>
  <div v-if="proposal?.proposalId" class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :proposal="proposal"
    />

    <div class="section-bottom">
      <div class="main_card left">
        Left tabs
      </div>

      <div class="right">
        <div class="main_card outcome">
          Outcome
        </div>

        <div class="main_card roadmap">
          Roadmap
        </div>
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
const governanceProposalStore = useGovernanceProposalsStore();
const proposal = computed(() => {
  return governanceProposalStore.getProposal(web3Store.chainId, fundStore.fund?.address, proposalId);
})
// defined icons for submission
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

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
.proposal-detail {
  .proposal-name {
    margin-bottom: 1.5rem;
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .container-meta {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;

    margin-bottom: 1.5rem;

    @include sm {
      flex-direction: row;
      gap: 1rem;
    }

    .meta {
      width: 100%;

      @include sm {
        width: 75%;
      }
    }

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;

      // remove margin bottom for last child
      &:last-child {
        margin-bottom: 0;
      }
    }

    .meta__item {
      display: flex;
      align-items: center;
      gap: 0.15rem;

      color: $color-steel-blue;
    }

    .meta__label {
      display: inline;

      font-size: 13px;

      letter-spacing: 0.03em;
      text-align: center;
    }

    .copy-icon {
      cursor: pointer;

      rotate: 180deg;
      transform: scaleX(-1);
    }
  }
}

.submission {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;

  color: $color-white;

  &__text {
    font-size: 0.8rem;
  }
}

.section-bottom {
  display: flex;
  gap: 2rem;
  justify-content: space-between;

  .left {
    width: 75%;
  }

  .right {
    width: 25%;
    display: flex;
    flex-direction: column;

    .outcome {
      padding: 1rem;
    }

    .roadmap {
      padding: 1rem;
    }
  }
}
</style>
