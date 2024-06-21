<template>
  <div class="proposal-detail">
    <FundGovernanceProposalSectionTop
      :title="proposalDetails.title"
      :tags="proposalDetails.tags"
      :submission="proposalDetails.submission"
      :meta-bottom="metaBottom"
      :voting-power="proposalDetails.votingPower"
    />

    <div class="section-bottom">
      <div class="main_card section-bottom--left">Left tabs</div>

      <div class="section-bottom--right">
        <UiDataRowCard title="Outcome" class="data_row_card">
          <!-- TODO: check how to set defaut-active state for accordion/expansion card -->
          <template #body>
            <div class="section-bottom__outcome">
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
            <div class="section-bottom__roadmap">Roadmap</div>
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
  tags: ["active", "direct_execution"],
  votingPower: "100",
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

.section-bottom {
  display: flex;
  gap: 2rem;
  justify-content: space-between;
  align-items: flex-start;

  &--left {
    width: 75%;
  }

  &--right {
    width: 25%;
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
}
</style>
