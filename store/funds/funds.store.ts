import { defineStore } from "pinia";
import { Web3 } from "web3";

import { useActionState } from "../actionState.store";
import { calculateFundsPerformanceMetricsAction } from "./actions/calculateFundsPerformanceMetrics.action";
import { fetchFundsAction } from "./actions/fetchFunds.action";
import { fetchFundsInfoArraysAction } from "./actions/fetchFundsInfoArrays.action";
import { fetchFundsMetaDataAction } from "./actions/fetchFundsMetadata.action";
import { fetchFundsNAVDataAction } from "./actions/fetchFundsNAVData.action";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFund from "~/types/fund";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import { networksMap } from "~/store/web3/networksMap";


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
