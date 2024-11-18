import { defineStore } from "pinia";
import { Web3 } from "web3";

import { useActionState } from "../actionState.store";
import { calculateFundsPerformanceMetricsAction } from "./actions/calculateFundsPerformanceMetrics.action";
import { fetchFundsAction } from "./actions/fetchFunds.action";
import { fetchFundsInfoArraysAction } from "./actions/fetchFundsInfoArrays.action";
import { fetchFundsMetaDataAction } from "./actions/fetchFundsMetadata.action";
import { fetchFundsNAVDataAction } from "./actions/fetchFundsNAVData.action";

import addressesJson from "~/assets/contracts/addresses.json";
import { GovernableFundFactory } from "~/assets/contracts/GovernableFundFactory";
import { RethinkReader } from "~/assets/contracts/RethinkReader";

import SafeMultiSendCallOnlyJson from "~/assets/contracts/safe/SafeMultiSendCallOnly.json";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IAddresses from "~/types/addresses";
import type { IContractAddresses } from "~/types/addresses";
import type IFund from "~/types/fund";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import { networksMap } from "~/store/web3/networksMap";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;
const SafeMultiSendCallOnlyAddresses: IContractAddresses =
  SafeMultiSendCallOnlyJson.networkAddresses as IContractAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";

interface IState {
  // chainFunds[chainId] = [fund1, fund2...]
  chainFunds: Record<string, IFund[]>;
  chainFundNAVUpdates: Record<string, Record<string, INAVUpdate[]>>;
  // All original NAV methods.
  allNavMethods: INAVMethod[];
  uniqueNavMethods: INAVMethod[];
  // Get the address of the original fund of all original NAV methods.
  navMethodDetailsHashToFundAddress: Record<string, string>;
}

export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    chainFunds: {} as Record<string, IFund[]>,
    chainFundNAVUpdates: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, INAVUpdate[]>>,
    allNavMethods: [] as INAVMethod[],
    uniqueNavMethods: [] as INAVMethod[],
    navMethodDetailsHashToFundAddress: {} as Record<string, string>,
  }),
  getters: {
    funds(): IFund[] {
      // Return a flat list of funds from all chains.
      return Object.values(this.chainFunds).reduce(
        (acc, funds) => acc.concat(funds),
        [],
      );
    },
    fundStore(): any {
      return useFundStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): Web3 {
      return this.web3Store.web3;
    },
    /**
     * Contracts
     */
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundFactoryContract(): Contract {
      const contractAddress =
        addresses[GovernableFundFactoryContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(
        GovernableFundFactory.abi,
        contractAddress,
      );
    },
    // @ts-expect-error: we should extend the return type as Contract<...>
    rethinkReaderContract(): Contract {
      const contractAddress =
        addresses[RethinkReaderContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(RethinkReader.abi, contractAddress);
    },
    safeMultiSendCallOnlyToAddress(): string {
      return SafeMultiSendCallOnlyAddresses[
        parseInt(this.web3Store.chainId).toString()
      ];
    },
  },
  actions: {
    fetchFundsInfoArrays(chainId: string) {
      return useActionState("fetchFundsInfoArraysAction", () =>
        fetchFundsInfoArraysAction(chainId),
      );
    },
    /**
     * Fetches all funds data from the GovernableFundFactory.
     */
    fetchFunds() {
      return useActionState("fetchFundsAction", () => fetchFundsAction());
    },
    /**
     * Fetch funds and their metadata and NAV data.
     * This will return funds with just enough data to populate the discover table.
     * More data can be fetched from fundSettings later if needed, or added to the reader contract.
     */
    fetchFundsMetaData(
      chainId: string,
      fundAddresses: string[],
      fundsInfo: any,
    ) {
      return useActionState("fetchFundsMetaDataAction", () =>
        fetchFundsMetaDataAction(chainId, fundAddresses, fundsInfo),
      );
    },
    fetchFundsNAVData(chainId: string, fundsInfoArrays: any[]) {
      return useActionState("fetchFundsNAVDataAction", () =>
        fetchFundsNAVDataAction(chainId, fundsInfoArrays),
      );
    },
    calculateFundsPerformanceMetrics(chainId: string) {
      return useActionState("calculateFundsPerformanceMetricsAction", () =>
        calculateFundsPerformanceMetricsAction(chainId),
      );
    },
  },
});
