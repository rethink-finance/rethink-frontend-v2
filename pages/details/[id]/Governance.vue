<template>
  <div>
    <div class="main_card">
      <div class="header">
        <div class="header__title-col">
          <div class="header__title">
            Governance Activity
          </div>
          <div class="header__sub-title">
            7 Pending Proposals
          </div>
        </div>
        <UiDropdown :options="dropdownOptions" />
      </div>
      <div class="tools">
        <v-btn class="all_activity_btn text-secondary" variant="outlined">
          <div>
            All Activity
          </div>
          <div class="all_activity_btn__subtext">
            (9 Proposals)
          </div>
          <Icon
            icon="mdi:filter-variant"
            width="1rem"
          />
        </v-btn>
        <div class="tools__success-rate">
          <div class="tools__val">
            50%
          </div>
          <div class="tools__subtext">
            Success Rate
          </div>
        </div>
      </div>
      <GovernanceTable :methods="methods" />
    </div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        Governance Settings
      </div>
      <div>
        <FundOverviewGovernance :fund="fund" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import GovernanceTable from "~/components/fund/governance/GovernanceTable.vue";
import type IFund from "~/types/fund";

// Example data
const methods = [{
  title: "Unlock airdrop permission to 0x25dfdgfg",
  submission: "missing",
  approval: "50%",
  participation: "20%",
  tags: ["active", "failed"],
},
{
  title: "Automate NAV Update execution for yhe ",
  submission: "missing",
  approval: "50%",
  participation: "20%",
  tags: ["active", "failed"],
},
{
  title: "Unlock airdrop permission to 0x25dfdgfg",
  submission: "missing",
  approval: "50%",
  participation: "20%",
  tags: ["active", "failed"],
},
{
  title: "Automate NAV Update execution for yhe ",
  submission: "missing",
  approval: "50%",
  participation: "20%",
  tags: ["active", "failed"],
},
]

const fund = useAttrs().fund as IFund;
const dropdownOptions = ["Delegated Permissions", "Direct Execution", "NAV Methods", "Fund Settings"];
</script>

<style scoped lang="scss">

.header{
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__title-col{
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__title{
    font-size: $text-md;
    color: $color-white;
    font-weight: 700;
  }

  &__sub-title{
    font-size: $text-sm;
    color: $color-text-irrelevant;
    font-weight: 500;
  }
}

.tools{
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__success-rate{
    display: flex;
    flex-direction: column;
    align-items: end;
  }

  &__val{
    font-weight: 700;
    font-size: $text-md;
    color: $color-white;
  }

  &__subtext{
    font-weight: 500;
    font-size: $text-sm;
  }
}

.all_activity_btn{
  @include borderGray;
  display: flex;
  flex-direction: row;

  &__subtext{
    color: $color-text-irrelevant;
    font-size: $text-sm;
    font-weight: 500;
    margin: 0 .75rem;
  }

}

</style>
