import { defineStore } from "pinia";

import { useActionState } from "../actionState.store";
import { fetchFundInitCacheAction } from "./actions/fetchFundInitCache.action";
import { useAccountStore } from "~/store/account/account.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFundSettings from "~/types/fund_settings";
import type { IFundInitCache } from "~/types/fund_settings";
import { clearLocalStorageItem } from "~/composables/localStorage";

interface IState {
  fundInitCache?: IFundInitCache;
  askToSaveDraftBeforeRouteLeave: boolean;
}


// combine funds and fund store and map address => fund state; why only store one fund details at a time
export const useCreateFundStore = defineStore({
  id: "createFund",
  state: (): IState => ({
    fundInitCache: undefined,
    askToSaveDraftBeforeRouteLeave: true,
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
    fundChainId(): string {
      return this.fundInitCache?.fundSettings?.chainId || "";
    },
    onboardingWhitelistLocalStorageKey(): string {
      return "onboardingWhitelist_" + this.fundChainId || "undefined";
    },
    onboardingStepperEntryLocalStorageKey(): string {
      return "onboardingStepperEntry_" + this.fundChainId || "undefined";
    },
    fundSettings(): IFundSettings | undefined {
      return this.fundInitCache?.fundSettings;
    },
  },
  actions: {
    fetchFundInitCache(
      fundChainId: string,
      deployerAddress: string,
    ): Promise<IFundInitCache | undefined> {
      return useActionState("fetchFundInitCacheAction", () =>
        fetchFundInitCacheAction(fundChainId, deployerAddress),
      );
    },
    clearFundInitCache() {
      this.fundInitCache = undefined;
    },
    clearFundLocalStorage() {
      clearLocalStorageItem(this.onboardingWhitelistLocalStorageKey);
      clearLocalStorageItem(this.onboardingStepperEntryLocalStorageKey);
    },
  },
});
