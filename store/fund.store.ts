import { BaseContract, ethers } from "ethers";
import { defineStore } from "pinia";
import { Contract } from "web3-eth-contract";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import { useAccountsStore } from "~/store/accounts.store";
import { PositionType } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IToken from "~/types/token";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import addressesJson from "~/assets/contracts/addresses.json";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IPositionType from "~/types/position_type";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const ContractName = "GovernableFundFactoryBeaconProxy";

export interface FundContract extends BaseContract {
  requestDeposit: (amount: ethers.BigNumberish, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  totalWithrawalBalance: (options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  revokeDepositWithrawal: (isDeposit: boolean, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  deposit: (options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  approve: (spender: string, amount: ethers.BigNumberish, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
}

interface IState {
  fund: IFund;
  abi: Record<string, any>;
  address: Record<string, any>;
  apy: Record<string, any>;
  userBalance: Record<string, any>;
  userFundBalance: string;
  userFundUsdValue: string
  selectedFundAddress: string;
  fundsSettings: Record<string, IFundSettings>;
}

const defaultFund: IFund = {
  address: "N/A",
  title: "N/A",
  subtitle: "N/A",
  chain: "N/A",
  avatarUrl: "https://api.lorem.space/image/ai?w=60&h=60",
  description: "N/A",
  governorAddress: "0x0",
  safeAddress: "0x0",
  inceptionDate: "N/A",
  aumValue: 0,
  cumulativeReturnPercent: 0,
  monthlyReturnPercent: 0,
  sharpeRatio: 0,
  userFundBalance: "N/A",
  userFundUsdValue: "N/A",
  nextSettlement: "N/A",
  positionTypes: [],
  cyclePendingRequests: [],
  fundToken: {} as IToken,
  denominationToken: {} as IToken,
  governorToken: {} as IToken,
  fundToDenominationExchangeRate: 0,
  netDeposits: "N/A",
  currentValue: "N/A",
  totalReturn: 0,
  delegatingAddress: "0x0",
  votingPower: "N/A",
  depositAddresses: [],
  managementAddresses: [],
  plannedSettlementCycle: "N/A",
  minLiquidAssetShare: "N/A",
  votingDelay: "N/A",
  votingPeriod: "N/A",
  proposalThreshold: "N/A",
  quorom: "N/A",
  lateQuorom: "N/A",
  navUpdates: [],
};

export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: {} as IFund,
    abi: {},
    address: {},
    apy: {},
    userBalance: {},
    userFundBalance: "",
    userFundUsdValue: "",
    selectedFundAddress: "N/A",
    fundsSettings: {} as Record<string, IFundSettings>,
  }),
  getters: {
    accountsStore(): any {
      return useAccountsStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): any {
      return this.web3Store.web3;
    },
    getFundAddress(state: IState): string {
      return state.address?.[state.selectedFundAddress];
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundContract(): Contract {
      const contractAddress = addresses[ContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(GovernableFundFactory.abi, contractAddress)
    },
    funds(): IFund[] {
      return Object.values(this.fundsSettings).map(
        (chainFund)=> {
          return {
            address: chainFund.fundAddress || "",
            title: chainFund.fundName || "N/A",
            subtitle: chainFund.fundName || "N/A",
            description: chainFund.fundName || "N/A",
            safeAddress: chainFund.safe || "",
            governorAddress: chainFund.governor || "",
            avatarUrl: "https://api.lorem.space/image/ai?w=60&h=60",
            fundToken: {
              symbol: chainFund.fundSymbol || "N/A",
              address: chainFund.baseToken || "N/A",
              balance: 0,
            },
            denominationToken: {
              symbol: "USDC",
              address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
              balance: 0,
            },
            governorToken: {
              symbol: "TODO", // TODO get governanceToken?
              address: chainFund.governanceToken || "N/A",
              balance: 0,
            },
            chain: "",
            inceptionDate: "",
            aumValue: 0,
            cumulativeReturnPercent: 0,
            monthlyReturnPercent: 0,
            sharpeRatio: 0,
            userFundBalance: "",
            userFundUsdValue: "",
            nextSettlement: "",
            // TODO remove these position types, replace with []
            positionTypes: [
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
            ] as IPositionType[],
            cyclePendingRequests: [] as ICyclePendingRequest[],
            fundToDenominationExchangeRate: 0,

            // My Fund Positions
            netDeposits: "",
            currentValue: "",
            totalReturn: 0,
            delegatingAddress: "",
            votingPower: "",

            // Overview fields
            depositAddresses: [],
            managementAddresses: [],
            plannedSettlementCycle: "",
            minLiquidAssetShare: "",

            // Governance
            votingDelay: "",
            votingPeriod: "",
            proposalThreshold: "",
            quorom: "",
            lateQuorom: "",

            // NAV Updates
            navUpdates: [] as INAVUpdate[],
          } as IFund
        },
      );
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
          title: "TFD3",
          subtitle: "Soonami Treasury Test",
          avatarUrl: "https://api.lorem.space/image/ai?w=60&h=60",
          chain: "avalanche",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inceptionDate: "2021 Feb 16",
          aumValue: 223541227, // "$223,541,227"
          cumulativeReturnPercent: -0.1983,
          monthlyReturnPercent: -0.1609,
          sharpeRatio: 0.85,
          address: "0xface6562d7e39ea73b67404a6454fbbbefeca553",
          governorAddress: "0xluk4c4d5e6f7g8h9i0dj1k2l3m45o6p7q8r9s0t",
          safeAddress: "0xbyebyed5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
          userFundBalance: "2135",
          userFundUsdValue: "$2135",
          nextSettlement: "5 Days",
          positionTypes: [
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
          cyclePendingRequests: [
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
          fundToken: {
            symbol: "tfd3",
            address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
            balance: 100,
          },
          denominationToken: {
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            balance: 120,
          },
          governorToken: {
            symbol: "USDC",
            address: "0xH2Z3BZ91c6301b36c1d19D4a2e9b0cE3606eB05",
            balance: 120,
          },
          fundToDenominationExchangeRate: 1.15,
          depositAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          managementAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          plannedSettlementCycle: "14 Days",
          minLiquidAssetShare: "50%",
          // Governance
          votingDelay: "400",
          votingPeriod: "5600",
          proposalThreshold: "10.000 1FND",
          quorom: "10%",
          lateQuorom: "4000",
          navUpdates: [
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
          netDeposits: "$544,452,56",
          currentValue: "$1,544,452.56",
          totalReturn: 0.11,
          delegatingAddress: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          votingPower: "10",
        },
        "2": {
          title: "THL",
          subtitle: "Tetronode Treasury",
          avatarUrl: "https://api.lorem.space/image/finance?w=60&h=60",
          chain: "solana",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inceptionDate: "2024 Jan 04",
          aumValue: 223541227, // "$223,541,227"
          cumulativeReturnPercent: 0.3944,
          monthlyReturnPercent: -0.0809,
          sharpeRatio: 1.65,
          address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          governorAddress: "0xluk4c4d5e6f7g8h9i0dj1k2l3m45o6p7q8r9s0t",
          safeAddress: "0xbyebyed5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
          userFundBalance: "2135",
          userFundUsdValue: "$2135",
          nextSettlement: "5 Days",
          positionTypes: [
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
          cyclePendingRequests: [
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
          fundToken: {
            symbol: "SOON",
            address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
            balance: 100,
          },
          denominationToken: {
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            balance: 120,
          },
          governorToken: {
            symbol: "USDC",
            address: "0xH2Z3BZ91c6301b36c1d19D4a2e9b0cE3606eB05",
            balance: 120,
          },
          fundToDenominationExchangeRate: 1.15,
          depositAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          managementAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          plannedSettlementCycle: "14 Days",
          minLiquidAssetShare: "50%",
          // Governance
          votingDelay: "400",
          votingPeriod: "5600",
          proposalThreshold: "10.000 1FND",
          quorom: "10%",
          lateQuorom: "4000",
          navUpdates: [
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
          netDeposits: "$544,452,56",
          currentValue: "$1,544,452.56",
          totalReturn: 0.11,
          delegatingAddress: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          votingPower: "10",
        },
        "3": {
          title: "1FUND",
          subtitle: "1FUND DAO",
          avatarUrl: "https://api.lorem.space/image/game?w=60&h=60",
          chain: "ethereum",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inceptionDate: "2022 Dec 10",
          aumValue: 223541227, // "$223,541,227"
          cumulativeReturnPercent: 0.1255,
          monthlyReturnPercent: 0.1204,
          sharpeRatio: 1.65,
          address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          governorAddress: "0xluk4c4d5e6f7g8h9i0dj1k2l3m45o6p7q8r9s0t",
          safeAddress: "0xbyebyed5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
          userFundBalance: "2135",
          userFundUsdValue: "$2135",
          nextSettlement: "5 Days",
          positionTypes: [
            {
              type: PositionType.NAVLiquid,
              value: 551,
            },
            {
              type: PositionType.NAVIlliquid,
              value: 852,
            },
          ],
          cyclePendingRequests: [
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
          fundToken: {
            symbol: "SOON",
            address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
            balance: 100,
          },
          denominationToken: {
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            balance: 120,
          },
          governorToken: {
            symbol: "USDC",
            address: "0xH2Z3BZ91c6301b36c1d19D4a2e9b0cE3606eB05",
            balance: 120,
          },
          fundToDenominationExchangeRate: 1.15,
          depositAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          managementAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          plannedSettlementCycle: "14 Days",
          minLiquidAssetShare: "50%",
          // Governance
          votingDelay: "400",
          votingPeriod: "5600",
          proposalThreshold: "10.000 1FND",
          quorom: "10%",
          lateQuorom: "4000",
          navUpdates: [
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
          netDeposits: "$544,452,56",
          currentValue: "$1,544,452.56",
          totalReturn: 0.11,
          delegatingAddress: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          votingPower: "10",
        },
        "4": {
          title: "AF",
          subtitle: "Awesome Fund",
          avatarUrl: "https://api.lorem.space/image/dashboard?w=60&h=60",
          chain: "dogecoin",
          description:
            "1FundDAO is a decentralized finance education company that has been teaching crypto since January 2018, and DeFi since 2020. Our fund uses providing liquidity in Uniswap V3. This is a way for LPs who do not have time to manage their portfolios to have exposure to LP's fully managed and based on the strategies and principles of 1FundDAO. This vault is only accessible to 1DAO members. To learn more, visit 1DAO.io",
          inceptionDate: "2021 Feb 16",
          aumValue: 223541227, // "$223,541,227"
          cumulativeReturnPercent: -0.1983,
          monthlyReturnPercent: -0.1609,
          sharpeRatio: 0.85,
          address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          governorAddress: "0xluk4c4d5e6f7g8h9i0dj1k2l3m45o6p7q8r9s0t",
          safeAddress: "0xbyebyed5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
          userFundBalance: "2135",
          userFundUsdValue: "$2135",
          nextSettlement: "5 Days",
          positionTypes: [
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
          cyclePendingRequests: [
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
          fundToken: {
            symbol: "SOON",
            address: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
            balance: 100,
          },
          denominationToken: {
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            balance: 120,
          },
          governorToken: {
            symbol: "USDC",
            address: "0xH2Z3BZ91c6301b36c1d19D4a2e9b0cE3606eB05",
            balance: 120,
          },
          fundToDenominationExchangeRate: 1.15,
          depositAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          managementAddresses: [
            "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xaacc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xddcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
            "0xggcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          ],
          plannedSettlementCycle: "14 Days",
          minLiquidAssetShare: "50%",
          // Governance
          votingDelay: "400",
          votingPeriod: "5600",
          proposalThreshold: "10.000 1FND",
          quorom: "10%",
          lateQuorom: "4000",
          navUpdates: [
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
          netDeposits: "$544,452,56",
          currentValue: "$1,544,452.56",
          totalReturn: 0.11,
          delegatingAddress: "0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t",
          votingPower: "10",
        },
      };
    },
  },
  actions: {
    getFund(fundAddress: string) {
      /**
       * This function finds and returns fund in the funds array.
       */
      const fund = this.funds.find(f => f.address === fundAddress);
      // TODO then use:
      // const fund = this.fundsSettings[fundAddress];
      if (fund) {
        this.fund = { ...this.fund, ...fund };
        this.selectedFundAddress = fundAddress;
        console.log("Selected Fund Address set to: ", this.selectedFundAddress);
      } else {
        console.error(`Fund not found with address: ${fundAddress}`);
      }
    },
    async fetchFundSettings() {
      /**
       * This function fetches all funds data from the GovernableFundFactory.
       */
      console.log("fetchFundSettings");
      const fundContract = this.fundContract;
      const fundsLength = await fundContract.methods.registeredFundsLength().call();

      const fundsInfo = await fundContract.methods.registeredFundsData(0, fundsLength).call();
      const fundAddresses: string[] = fundsInfo[0];

      for (let i = 0; i < fundAddresses.length; i++) {
        const fundAddress: string = fundAddresses[i] as string;
        const fundSettings: Partial<IFundSettings> = { address: fundAddress };

        // Directly iterate over the details object's entries.
        Object.entries(fundsInfo[1][i]).forEach(([key, value]) => {
          // Assume that every key in details corresponds to a valid key in IFundSettings.
          const detailKey = key as keyof IFundSettings;

          // Convert bigint values to strings, otherwise assign the value directly.
          // This approach skips checking if detailKey is explicitly part of fundSettings
          // since fundSettings is typed as Partial<IFundSettings> and initialized accordingly.
          fundSettings[detailKey] = typeof value === "bigint" ? value.toString() : value;
        });
        if (!this.fundsSettings[fundAddress]) {
          this.fundsSettings[fundAddress] = fundSettings as IFundSettings;
        }
      }
    },
    async fetchFunds() {
      try {
        await this.fetchFundSettings();
      } catch(e) {
        console.error(e);
      }
    },
    async fetchUserBalance() {
      if (!this.fundContract) {
        // this.fetchContract();
        if (!this.fundContract) return console.error("Contract not found");
      }
      const accountsStore = useAccountsStore();
      const activeAccount = accountsStore.activeAccount;
      if (!activeAccount) return console.error("Active account not found");

      const balanceWei = await this.fundContract.balanceOf(activeAccount);
      this.userFundBalance = ethers.formatEther(balanceWei);
    },
    async fetchUserFundUsdValue() {
      if (!this.fundContract) {
        // await this.fetchContract();
        await this.fetchUserBalance();
        if (!this.fundContract) return console.error("Contract not found");
      }

      const accountsStore = useAccountsStore();
      const activeAccount = accountsStore.activeAccount;
      if (!activeAccount) return console.error("Active account not found");

      let balanceWei = "0";
      try {
        balanceWei = await this.fundContract.valueOf(this.userBalance[this.selectedFundAddress]).toString();
      } catch (e) {
        console.log("The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error.");
      }

      const value = ethers.formatEther(balanceWei);
      this.userFundUsdValue = value;
    },
    fetchFundBalance() {
      // mock data
      return "10000"
    },
  },
});
