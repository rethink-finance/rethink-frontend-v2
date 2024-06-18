<template>
  <div class="page-governance">
    <UiDataRowCard title="Governance Settings" class="data_row_card">
      <template #body>
        <FundOverviewGovernance :fund="fund" />
      </template>
    </UiDataRowCard>

    <UiMainCard title="Governance Activity" subtitle="7 Pending Proposals">
      <template #header-right>
        <UiDropdown :options="dropdownOptions" label="Create Proposal" />
      </template>
      <template #tools>
        <v-btn
          class="tools__all-activity-btn text-secondary"
          variant="outlined"
        >
          <div>All Activity</div>
          <div class="tools__all-activity-btn__subtext">(9 Proposals)</div>
          <Icon icon="mdi:filter-variant" width="1rem" />
        </v-btn>
        <div class="tools__success-rate">
          <div class="tools__val">50%</div>
          <div class="tools__subtext">Success Rate</div>
        </div>
      </template>
      <TableGovernance :items="tableGovernance" />
    </UiMainCard>

    <UiMainCard title="Trending Delegates" subtitle="4 Delegated Wallets">
      <template #header-right>
        <UiLinkExternalButton
          class="main-card__manage-button"
          title="Manage Delegation"
          :href="manageDelegateUrl"
        />
      </template>
      <TableTrendingDelegates :items="trendingDelegates" />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
// types
import type IFund from "~/types/fund";
import type GOVActivity from "~/types/governance_activity";
import type ITrendingDelegates from "~/types/trending_delegates";
// components
import TableGovernance from "~/components/fund/governance/TableGovernance.vue";
import TableTrendingDelegates from "~/components/fund/governance/TableTrendingDelegates.vue";

// dummy data for manage delegate button
const manageDelegateUrl = "https://www.google.com";
// dummy data governance activity
const tableGovernance: GOVActivity[] = [
  {
    id: "75jfh475hqc",
    title: "Unlock airdrop permission to 0x1f98dgfgF984",
    submission: "Pending",
    approval: "40%",
    participation: "10%",
    tags: ["active", "permission"],
  },
  {
    id: "51jfh475hqc",
    title: "Automate NAV Update execution for yhe ",
    submission: "Missed",
    approval: "50%",
    participation: "20%",
    tags: ["executed", "nav"],
  },
  {
    id: "15fa475hqc",
    title: "Unlock airdrop permission to 0x1f98dgfgF984",
    submission: "Abstained",
    approval: "60%",
    participation: "22%",
    tags: ["defeated", "direct_execution"],
  },
  {
    id: "75jfh475abq",
    title: "Automate NAV Update execution for yhe ",
    submission: "Rejected",
    approval: "75%",
    participation: "50%",
    tags: ["to_execute", "permission"],
  },
  {
    id: "75jfh475hqd",
    title: "Automate NAV Update execution for yhe ",
    submission: "Approved",
    approval: "90%",
    participation: "5%",
    tags: ["canceled", "permission"],
  },
];
// Dummy data for trending delegates
const trendingDelegates: ITrendingDelegates[] = [
  {
    delegated_members: "0x1f98dgdaddasdfgF984",
    delegators: "16 Members",
    impact: "10%",
    voting_power: "570.000.000 SOON",
  },
  {
    delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
    delegators: "13 Members",
    impact: "20%",
    voting_power: "850.000.000 SOON",
  },
  {
    delegated_members: "0x1f98dgdaddasdfgF984",
    delegators: "8 Members",
    impact: "8%",
    voting_power: "440.000.000 SOON",
  },
  {
    delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
    delegators: "5 Members",
    impact: "16%",
    voting_power: "720.000.000 SOON",
  },
];
// Dummy data for dropdown options
const dropdownOptions = [
  "Delegated permissions",
  "Direct Execution",
  "NAV Methods",
  "Fund Settings",
];

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">
.tools {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__success-rate {
    display: flex;
    flex-direction: column;
    align-items: end;
  }

  &__val {
    font-weight: 700;
    font-size: $text-md;
    color: $color-white;
  }

  &__subtext {
    font-weight: 500;
    font-size: $text-sm;
  }
}

.tools__all-activity-btn {
  @include borderGray;
  display: flex;
  flex-direction: row;

  &__subtext {
    color: $color-text-irrelevant;
    font-size: $text-sm;
    font-weight: 500;
    margin: 0 0.75rem;
  }
}

// overrides for expansion-panel
.data_row_card {
  margin-bottom: 2rem;

  ::v-deep {
    // remove outer border
    .data_row__panel {
      border: 0;
      border-radius: 0.25rem !important;
      background-color: rgb(var(--v-theme-surface));
    }
    // add more spacing to content inside
    .v-expansion-panel-text__wrapper {
      padding-bottom: 2rem;
    }

    // add borders to textfields inside panel
    .v-expansion-panels {
      border: 1px solid $color-gray-transparent;
      border-radius: 0.25rem !important;

      .data_row__panel {
        padding: 0;
      }
    }
  }
}
</style>
