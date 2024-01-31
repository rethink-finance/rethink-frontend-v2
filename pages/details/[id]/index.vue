<template>
  <div style="width: 70%" class="mt-8">
    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>
    <div class="main_card settlement_grid">
      <div>
        <FundSettlement :fund="fund" />
      </div>
      <div>
        <FundCurrentCycle :fund="fund" />
      </div>
    </div>
    <div class="main_card">
      <FundChart :fund-id="fund.id" />
    </div>
    <div class="">
      <FundOverview :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type IFund from "~/types/fund";
import { PositionType } from "~/types/enums/position_type";

const route = useRoute();
console.log("Fetch fund: " + route.params.id);

// This data will be fetched from some API.
const fundData: IFund = {
  id: 1,
  title: "SOON",
  subtitle: "Soonami Treasury",
  avatar_url: "https://api.lorem.space/image/finance?w=60&h=60",
  chain: "avalanche",
  description:
    "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
  inception_date: "2022 Dec 10",
  aum_value: 223541227, // "$223,541,227"
  cumulative_return_percent: 0.3944,
  monthly_return_percent: -0.0809,
  sharpe_ratio: 1.65,
  address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
  governor_address: "0xluk4c4d5e6f7g8h9i0dj1k2l3m45o6p7q8r9s0t",
  safe_address: "0xbyebyed5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
  user_fund_balance: "2135",
  user_fund_usd_value: "$2135",
  next_settlement: "5 Days",
  position_types: [
    {
      type: PositionType.NAVLiquid,
      value: 123,
    },
    {
      type: PositionType.NAVComposable,
      value: 78,
    },
    {
      type: PositionType.NAVNft,
      value: 287,
    },
    {
      type: PositionType.NAVIlliquid,
      value: 36,
    },
  ],
  cycle_pending_requests: [
    {
      id: "1",
      token: "SOON",
      available_tokens: 3570,
      pending_tokens: 128,
    },
    {
      id: "2",
      token: "USDC",
      available_tokens: 1284,
      pending_tokens: 988,
    },
  ],
  fund_token: {
    name: "SOON",
    address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    balance: 100,
  },
  denomination_token: {
    name: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    balance: 120,
  },
  governor_token: {
    name: "USDC",
    address: "0xH2Z3BZ91c6301b36c1d19D4a2e9b0cE3606eB05",
    balance: 120,
  },
  fund_to_denomination_exchange_rate: 1.15,
  deposit_addresses: [
    "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
  ],
  management_addresses: [
    "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
    "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
  ],
  planned_settlement_cycle: "14 Days",
  min_liquid_asset_share: "50%",
  // Governance
  voting_delay: "400",
  voting_period: "5600",
  proposal_threshold: "10.000 1FND",
  quorom: "10%",
  late_quorom: "4000",
};

const fund = ref(fundData);
</script>

<style lang="scss" scoped>
.settlement_grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  /* TODO mobile 1 col, display flex */
}
</style>
