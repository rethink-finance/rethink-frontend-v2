import { defineStore } from "pinia";

import { useActionState } from "../actionState.store";
import { fetchFundInitCacheAction } from "./actions/fetchFundInitCache.action";
import { clearLocalStorageItem } from "~/composables/localStorage";
import { useAccountStore } from "~/store/account/account.store";
import { networksMap } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";
import type IFundSettings from "~/types/fund_settings";
import type IFundInitCache from "~/types/fund_init_cache";

interface IState {
  selectedStepperChainId?: ChainId;
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
    fundChainId(): ChainId {
      if (this.fundInitCache?.fundSettings?.chainId) {
        return this.fundInitCache.fundSettings.chainId;
      }

      return this.selectedStepperChainId || ChainId.ETHEREUM;
    },
    fundChainName(): string {
      const defaultValue = this.fundChainId;

      if (!this.fundChainId) return defaultValue;
      return networksMap[this.fundChainId]?.chainName || defaultValue;
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
    fundFactoryContractV2Used(): boolean {
      return this.fundInitCache?.fundFactoryContractV2Used || false;
    },
    fundFactoryContract() {
      // If V2 roles are used, use the v2 fund factory contract.
      const contractKey = this.fundFactoryContractV2Used() ? "fundFactoryContractV2" : "fundFactoryContract";
      return this.web3Store().chainContracts[this.fundChainId()]?.[contractKey];
    },
  },
  actions: {
    fetchFundInitCache(
      fundChainId: ChainId,
      deployerAddress: string,
    ): Promise<IFundInitCache | undefined> {
      return useActionState("fetchFundInitCacheAction", () =>
        fetchFundInitCacheAction(fundChainId, deployerAddress),
      );
    },
    setSelectedStepperChainId(chainId: ChainId) {
      this.selectedStepperChainId = chainId;
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
