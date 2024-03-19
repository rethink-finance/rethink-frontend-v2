import { ethers } from "ethers";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import { useAccountsStore } from "~/store/accounts.store";
import { PositionType } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundChainSettings from "~/types/fund_chain_settings";
import type IToken from "~/types/token";
interface IState {
  fund: IFund;
  funds: IFund[];
  abi: Record<string, any>;
  address: Record<string, any>;
  apy: Record<string, any>;
  contract: Record<string, any>;
  userBalance: Record<string, any>;
  userFundUsdValue: Record<string, any>;
  selectedFundAddress: string;
  chainFundsSettings: IFundChainSettings[];
}

const defaultFund: IFund = {
  id: 0,
  address: "N/A",
  title: "N/A",
  subtitle: "Lorem Ipsum",
  chain: "N/A",
  avatar_url: "https://api.lorem.space/image/ai?w=60&h=60",
  description: "N/A",
  governor_address: "N/A",
  safe_address: "N/A",
  inception_date: "N/A",
  aum_value: 0,
  cumulative_return_percent: 0,
  monthly_return_percent: 0,
  sharpe_ratio: 0,
  user_fund_balance: "N/A",
  user_fund_usd_value: "N/A",
  next_settlement: "N/A",
  position_types: [],
  cycle_pending_requests: [],
  fund_token: {} as IToken,
  denomination_token: {} as IToken,
  governor_token: {} as IToken,
  fund_to_denomination_exchange_rate: 0,
  net_deposits: "N/A",
  current_value: "N/A",
  total_return: 0,
  delegating_address: "N/A",
  voting_power: "N/A",
  deposit_addresses: [],
  management_addresses: [],
  planned_settlement_cycle: "N/A",
  min_liquid_asset_share: "N/A",
  voting_delay: "N/A",
  voting_period: "N/A",
  proposal_threshold: "N/A",
  quorom: "N/A",
  late_quorom: "N/A",
  nav_updates: [],
};

export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: defaultFund as IFund,
    funds: [] as IFund[],
    abi: {},
    address: {},
    apy: {},
    contract: {},
    userBalance: {},
    userFundUsdValue: {},
    selectedFundAddress: "N/A",
    chainFundsSettings: [] as IFundChainSettings[],
  }),
  getters: {
    accountsStore(): any {
      return useAccountsStore();
    },
    web3(): any {
      return this.accountsStore.web3;
    },
    getApy(state: IState): string {
      return state.apy?.[state.selectedFundAddress];
    },
    getSelectedFundAddress(state: IState): string {
      return state.selectedFundAddress;
    },
    geFundAbi(state: IState): any {
      return state.abi?.[state.selectedFundAddress];
    },
    getFundAddress(state: IState): string {
      return state.address?.[state.selectedFundAddress];
    },
    getFundContract(state: IState): any {
      return state.contract?.[state.selectedFundAddress];
    },
    getUserFundUsdValue(state: IState): string {
      return state.userFundUsdValue?.[state.selectedFundAddress];
    },
    getFunds(): IFund[] {
      // return Object.values(this.demoFunds);
      return Object.values(this.funds);
    },

    demoFunds(): Record<string, IFund> {
      // Remove this method.
      const NAVDetailsJSON = {
        nav_liquid: `{
          "tokenPair": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
          "aggregatorAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
          "functionSignatureWithEncodedInputs": null,
          "assetTokenAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
          "nonAssetTokenAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
          "isReturnArray": "false",
          "returnLength": "4",
          "returnIndex": "1",
          "pastNAVUpdateIndex": "0"
        }`,
        nav_illiquid: `{
          "tokenPair": "0xNewTokenPairForIlliquid",
          "aggregatorAddress": "0xNewAggregatorAddressForIlliquid",
          "functionSignatureWithEncodedInputs": "NewFunctionSignatureForIlliquid",
          "assetTokenAddress": "0xNewAssetTokenAddressForIlliquid",
          "nonAssetTokenAddress": "0xNewNonAssetTokenAddressForIlliquid",
          "isReturnArray": "true",
          "returnLength": "6",
          "returnIndex": "2",
          "pastNAVUpdateIndex": "1"
        }`,
      };

      return {
        "1": {
          id: 1,
          title: "SOON",
          subtitle: "Soonami Treasury Test",
          avatar_url: "https://api.lorem.space/image/ai?w=60&h=60",
          chain: "avalanche",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inception_date: "2021 Feb 16",
          aum_value: 223541227, // "$223,541,227"
          cumulative_return_percent: -0.1983,
          monthly_return_percent: -0.1609,
          sharpe_ratio: 0.85,
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
          nav_updates: [
            {
              date: "12/12/2023",
              value: "$333,212,321.12",
              details: NAVDetailsJSON,
            },
            {
              date: "11/12/2023",
              value: "$323,519,111.11",
              details: NAVDetailsJSON,
            },
          ],
          // My Positions (user's)
          net_deposits: "$544,452,56",
          current_value: "$1,544,452.56",
          total_return: 0.11,
          delegating_address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          voting_power: "10",
        },
        "2": {
          id: 2,
          title: "THL",
          subtitle: "Tetronode Treasury",
          avatar_url: "https://api.lorem.space/image/finance?w=60&h=60",
          chain: "solana",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inception_date: "2024 Jan 04",
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
              value: 47,
            },
            {
              type: PositionType.NAVComposable,
              value: 23,
            },
            {
              type: PositionType.NAVIlliquid,
              value: 51,
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
          nav_updates: [
            {
              date: "12/12/2023",
              value: "$333,212,321.12",
              details: NAVDetailsJSON,
            },
            {
              date: "11/12/2023",
              value: "$323,519,111.11",
              details: NAVDetailsJSON,
            },
          ],
          // My Positions (user's)
          net_deposits: "$544,452,56",
          current_value: "$1,544,452.56",
          total_return: 0.11,
          delegating_address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          voting_power: "10",
        },
        "3": {
          id: 3,
          title: "1FUND",
          subtitle: "1FUND DAO",
          avatar_url: "https://api.lorem.space/image/game?w=60&h=60",
          chain: "ethereum",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inception_date: "2022 Dec 10",
          aum_value: 223541227, // "$223,541,227"
          cumulative_return_percent: 0.1255,
          monthly_return_percent: 0.1204,
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
              value: 551,
            },
            {
              type: PositionType.NAVIlliquid,
              value: 852,
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
          nav_updates: [
            {
              date: "12/12/2023",
              value: "$333,212,321.12",
              details: NAVDetailsJSON,
            },
            {
              date: "11/12/2023",
              value: "$323,519,111.11",
              details: NAVDetailsJSON,
            },
          ],
          // My Positions (user's)
          net_deposits: "$544,452,56",
          current_value: "$1,544,452.56",
          total_return: 0.11,
          delegating_address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          voting_power: "10",
        },
        "4": {
          id: 4,
          title: "AF",
          subtitle: "Awesome Fund",
          avatar_url: "https://api.lorem.space/image/dashboard?w=60&h=60",
          chain: "dogecoin",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inception_date: "2021 Feb 16",
          aum_value: 223541227, // "$223,541,227"
          cumulative_return_percent: -0.1983,
          monthly_return_percent: -0.1609,
          sharpe_ratio: 0.85,
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
          nav_updates: [
            {
              date: "12/12/2023",
              value: "$333,212,321.12",
              details: NAVDetailsJSON,
            },
            {
              date: "11/12/2023",
              value: "$323,519,111.11",
              details: NAVDetailsJSON,
            },
          ],
          // My Positions (user's)
          net_deposits: "$544,452,56",
          current_value: "$1,544,452.56",
          total_return: 0.11,
          delegating_address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          voting_power: "10",
        },
      };
    },

    getChainedFunds(state): IFund[] {
      return state.funds;
    },
  },
  actions: {
    // fetchFund(fundId: string) {
    //   this.fund = this.demoFunds[fundId];
    //   return this.fund;
    // },
    fetchFund(fundAddress: string) {
      const fund = this.funds.find(f => f.address === fundAddress);
      if (fund) {
        this.fund = fund;
      } else {
        console.error(`Fund not found with address: ${fundAddress}`);
      }
    },
    async fetchChainFundSettings() {
      const runtimeConfig = useRuntimeConfig();
      const provider = new ethers.JsonRpcProvider(runtimeConfig.public.INFURA_KEY || "");
      const contract = new ethers.Contract("0x4C342E583A7Aa2840e07B4a3afB71533FBE37726", GovernableFundFactory.abi, provider);

      const fundData: IFundChainSettings[] = [];
      const settingsNames: (keyof IFundChainSettings)[] = [
        "depositFee",
        "withdrawFee",
        "performanceFee",
        "managementFee",
        "performaceHurdleRateBps",
        "baseToken",
        "safe",
        "isExternalGovTokenInUse",
        "isWhitelistedDeposits",
        "allowedDepositAddrs",
        "allowedManagers",
        "governanceToken",
        "fundAddress",
        "governor",
        "fundName",
        "fundSymbol",
      ];
      const fundsLength = await contract.registeredFundsLength();
      const fundsInfo = await contract.registeredFundsData(0, fundsLength);
      for (let i = 0; i < fundsInfo[0].length; i++) {
        const fundSettings: Partial<IFundChainSettings> = { address: fundsInfo[0][i] };
        for (let j = 0; j < fundsInfo[1][i].length; j++) {
          const key = settingsNames[j];
          let value = fundsInfo[1][i][j];
          if (typeof value === "bigint") {
            value = value.toString();
          }
          fundSettings[key] = value;
        }
        fundData.push(fundSettings as IFundChainSettings);
      }

      this.chainFundsSettings = fundData;
    },
    async fetchFunds() {
      await this.fetchChainFundSettings();
      const mockFunds = this.demoFunds;
      this.funds = this.chainFundsSettings.map((chainFund,i )=> {
        return {
          ...this.fund,
          ...mockFunds[(i % 4) + 1],
          address: chainFund.fundAddress || "N/A",
          title: chainFund.fundName || "N/A",
          safe_address: chainFund.safe || "N/A",
          governor_address: chainFund.governor || "N/A",
          fund_token: {
            name: chainFund.fundSymbol || "N/A",
            address: chainFund.baseToken || "N/A",
            balance: 0,
          },
          denomination_token: {
            name: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            balance: 0,
          },
          governor_token: {
            name: "USDC",
            address: chainFund.governanceToken || "N/A",
            balance: 0,
          },

        }
      } );
      return this.funds;
    },
  },
});
