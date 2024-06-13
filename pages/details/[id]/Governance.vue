<template>
  <div>
    <div class="main_card">
      <div class="header">
        <div class="header__title-col">
          <div class="header__title">Governance Activity</div>
          <div class="header__sub-title">7 Pending Proposals</div>
        </div>
        <UiDropdown :options="dropdownOptions" label="Create Proposal" />
      </div>
      <div class="tools">
        <v-btn class="all_activity_btn text-secondary" variant="outlined">
          <div>All Activity</div>
          <div class="all_activity_btn__subtext">(9 Proposals)</div>
          <Icon icon="mdi:filter-variant" width="1rem" />
        </v-btn>
        <div class="tools__success-rate">
          <div class="tools__val">50%</div>
          <div class="tools__subtext">Success Rate</div>
        </div>
      </div>
      <TableGovernance :items="tableGovernance" />
    </div>

    <div class="main_card">
      <div class="header">
        <div class="header__title-col">
          <div class="header__title">Trending Delegates</div>
          <div class="header__sub-title">4 Delegated Wallets</div>
        </div>
        <UiLinkExternalButton
          class="fund_info_governance__manage_button"
          title="Manage Delegation"
          :href="manageDelegateUrl"
        />
      </div>

      <TableTrendingDelegates :items="trendingDelegates" />
    </div>
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
.header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__title-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__title {
    font-size: $text-md;
    color: $color-white;
    font-weight: 700;
  }

  &__sub-title {
    font-size: $text-sm;
    color: $color-text-irrelevant;
    font-weight: 500;
  }
}

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

.all_activity_btn {
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
  :deep .data_row__panel {
    background-color: rgb(var(--v-theme-surface));
    border-radius: 4px;
  }
}
</style>
