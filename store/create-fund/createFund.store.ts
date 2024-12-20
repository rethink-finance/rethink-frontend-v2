import { defineStore } from "pinia";

import { useActionState } from "../actionState.store";
import { fetchFundCacheAction } from "./actions/fetchFundCache.action";
import { useAccountStore } from "~/store/account/account.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { IFundInitCache } from "~/types/fund_settings";

interface IState {
  chainId: string;
  fundInitCache?: IFundInitCache;
}


// combine funds and fund store and map address => fund state; why only store one fund details at a time
export const useCreateFundStore = defineStore({
  id: "createFund",
  state: (): IState => ({
    // TODO get this chain ID from localStorage actually
    chainId: "0xa4b1",
    fundInitCache: undefined,
  }),
  getters: {
    accountStore(): any {
      return useAccountStore();
    },
    activeAccountAddress(): string | undefined {
      return this.accountStore.activeAccount?.address;
    },
    web3Store(): any {
      return useWeb3Store();
    },
  },
  actions: {
    fetchFundCacheAction(
      fundChainId: string,
      deployerAddress: string,
    ): Promise<void> {
      return useActionState("fetchFundCacheAction", () =>
        fetchFundCacheAction(fundChainId, deployerAddress),
      );
    },
  },
});
