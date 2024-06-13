<template>
  <div class="page-governance">
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

    <UiDataRowCard title="Governance Settings" class="data_row_card">
      <template #body>
        <FundOverviewGovernance :fund="fund" />
      </template>
    </UiDataRowCard>
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
    title: "Unlock airdrop permission to 0x25dfdgfg",
    submission: "Pending",
    approval: "40%",
    participation: "10%",
    tags: ["active", "permission"],
  },
  {
    title: "Automate NAV Update execution for yhe ",
    submission: "Missed",
    approval: "50%",
    participation: "20%",
    tags: ["executed", "nav"],
  },
  {
    title: "Unlock airdrop permission to 0x25dfdgfg",
    submission: "Abstained",
    approval: "60%",
    participation: "22%",
    tags: ["defeated", "direct_execution"],
  },
  {
    title: "Automate NAV Update execution for yhe ",
    submission: "Rejected",
    approval: "75%",
    participation: "50%",
    tags: ["to_execute", "permission"],
  },
  {
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
    delegated_members: "0x25dfdgdaddasdfg",
    delegators: "16 Members",
    impact: "10%",
    voting_power: "570.000.000 SOON",
  },
  {
    delegated_members: "0x25dfdgdaddasdfg",
    delegators: "13 Members",
    impact: "20%",
    voting_power: "850.000.000 SOON",
  },
  {
    delegated_members: "0x25dfdgdaddasdfg",
    delegators: "8 Members",
    impact: "8%",
    voting_power: "440.000.000 SOON",
  },
  {
    delegated_members: "0x25dfdgdaddasdfg",
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

.data_row_card {
  :deep(data_row__panel) {
    background-color: rgb(var(--v-theme-surface));
    border-radius: 4px;
  }
}
</style>
