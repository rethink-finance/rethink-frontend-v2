import { defineStore } from "pinia";

import { useActionState } from "../actionState.store";
import { networksMap } from "../web3/networksMap";
import { calculateFundsPerformanceMetricsAction } from "./actions/calculateFundsPerformanceMetrics.action";
import { fetchFundsAction } from "./actions/fetchFunds.action";
import { fetchFundsInfoArraysAction } from "./actions/fetchFundsInfoArrays.action";
import { fetchFundsMetaDataAction } from "./actions/fetchFundsMetadata.action";
import { fetchFundsNavMethodsAction } from "./actions/fetchFundsNavMethods.action";
import type INAVUpdate from "~/types/nav_update";
import type INAVMethod from "~/types/nav_method";
import type IFund from "~/types/fund";
import { type ChainId } from "~/types/enums/chain_id";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useFundStore } from "~/store/fund/fund.store";


interface IState {
  // chainFunds[chainId] = [fund1, fund2...]
  chainFunds: Record<string, IFund[]>;
  chainFundsInfoArrays: Record<string, any[]>;
  chainFundNAVUpdates: Record<string, Record<string, INAVUpdate[]>>;
  // All original NAV methods.
  allNavMethods: Record<string, INAVMethod[]>;
  uniqueNavMethods: Record<string, INAVMethod[]>;
  // Get the address of the original fund of all original NAV methods.
  navMethodDetailsHashToFundAddress: Record<string, string>;
}

export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    chainFunds: {} as Record<string, IFund[]>,
    chainFundsInfoArrays: {} as Record<string, any[]>,
    chainFundNAVUpdates: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, INAVUpdate[]>>,
    allNavMethods: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, []]),
    ) as Record<string, INAVMethod[]>,
    uniqueNavMethods: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, []]),
    ) as Record<string, INAVMethod[]>,
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
    chainAddressLabelMap(): Record<string, Record<string, string>> {
      const addressMap: Record<string, Record<string, string>> = {};
      for (const chainId in this.chainFunds.keys) {
        addressMap[chainId] = {};

        for (const fund of this.chainFunds[chainId]) {
          addressMap[chainId][fund.safeAddress] = fund.title + " Safe"
          addressMap[chainId][fund.address] = fund.title + " Vault"
        }
      }
      return addressMap
    },
  },
  actions: {
    fetchFundsInfoArrays(chainId: ChainId) {
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
      chainId: ChainId,
      fundAddresses: string[],
      fundsInfo: any,
    ) {
      return useActionState("fetchFundsMetaDataAction", () =>
        fetchFundsMetaDataAction(chainId, fundAddresses, fundsInfo),
      );
    },
    fetchFundsNavMethods(chainId: ChainId, fundsInfoArrays: any[], storeAllMethods = true) {
      return useActionState("fetchFundsNavMethodsAction", () =>
        fetchFundsNavMethodsAction(chainId, fundsInfoArrays, storeAllMethods),
      );
    },
    calculateFundsPerformanceMetrics(chainId: ChainId) {
      return useActionState("calculateFundsPerformanceMetricsAction", () =>
        calculateFundsPerformanceMetricsAction(chainId),
      );
    },
  },
});
