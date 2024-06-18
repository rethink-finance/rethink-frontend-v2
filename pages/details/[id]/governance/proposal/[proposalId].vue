<template>
  <div class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :title="proposalDetails.title"
      :tags="proposalDetails.tags"
      :submission="proposalDetails.submission"
      :meta-bottom="metaBottom"
    />

    <div class="section-bottom">
      <div class="main_card left">
        Left tabs
      </div>

      <div class="right">
        <UiDataRowCard title="Outcome" class="data_row_card">
          <!-- TODO: check how to set defaut-active state for accordion/expansion card -->
          <template #body>
            <div class="outcome">
              <FundGovernanceProgressInsight
                title="Approval Rate"
                :progress="parseInt(proposalDetails.approval)"
                subtext="Approval"
              />
              <FundGovernanceProgressInsight
                title="Participation Rate"
                :progress="parseInt(proposalDetails.participation)"
                subtext="Support"
              />
            </div>
          </template>
        </UiDataRowCard>
        <UiDataRowCard title="Roadmap" class="data_row_card">
          <template #body>
            <div class="outcome">
              Roadmap
            </div>
          </template>
        </UiDataRowCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// utils
import { formatHexAddress } from "~/composables/utils";
// types
import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
// emits
const emit = defineEmits(["updateBreadcrumbs"]);

const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Proposals",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
];

// dummy data
const proposalDetails = {
  id: "75jfh475hqc",
  createdBy: "0x1f98dgfgF984",
  title: "Unlock airdrop permission to 0x1f98dgfgF984",
  submission: "Pending",
  approval: "70",
  participation: "32.123412%",
  tags: ["active", "permission"],
};

const metaBottom = [
  {
    label: "Proposal ID:",
    value: proposalDetails.id,
  },
  {
    label: "Created by",
    value: proposalDetails.createdBy,
    format: formatHexAddress,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
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
  align-items: flex-start;

  .left {
    width: 75%;
  }

  .right {
    width: 25%;
    display: flex;
    flex-direction: column;

    .roadmap {
      padding: 1rem;
    }

    .outcome {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  }
}
</style>
