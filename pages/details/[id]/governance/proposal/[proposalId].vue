<template>
  <div class="proposal-detail">
    <!-- TODO better to just pass the proposalDetails as prop  -->
    <FundGovernanceProposalSectionTop
      :title="proposalDetails.title"
      :state="proposalDetails.state"
      :submission="proposalDetails.submission"
      :meta-bottom="metaBottom"
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
</template>

<script setup lang="ts">
import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
import { truncateAddress } from "~/composables/addressUtils";
import { ProposalState } from "~/types/enums/governance_proposal";
// emits
const emit = defineEmits(["updateBreadcrumbs"]);

const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "All Proposals",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Edit Proposal",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
];

// defined icons for submission
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

// dummy data
const proposalDetails = {
  id: "75jfh475hqc",
  createdBy: "0x1f98dgfgF984",
  state: ProposalState.Active,
  title: "Unlock airdrop permission to 0x1f98dgfgF984",
  submission: "Pending",
  approval: "40%",
  participation: "10%",
};

const metaBottom = [
  {
    label: "Proposal ID:",
    value: proposalDetails.id,
  },
  {
    label: "Created by",
    value: proposalDetails.createdBy,
    format: truncateAddress,
  },
];

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
