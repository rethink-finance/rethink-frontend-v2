import { defineStore } from "pinia";

interface IState {
  isManageMode: boolean;
  useIndexerForGovernance: boolean;
}

export const useSettingsStore = defineStore({
  id: "app-settings",
  state: (): IState => ({
    isManageMode: false,
    useIndexerForGovernance: true,
  }),
  actions: {
    toggleAdvancedMode() {
      setLocalStorageItem("isManageMode", this.isManageMode);
    },
    toggleUseIndexerForGovernance() {
      setLocalStorageItem("useIndexerForGovernance", this.useIndexerForGovernance);
    },
    // load advanced mode from local storage and set it to the store
    loadSettings() {
      const isManageMode = getLocalStorageItem("isManageMode");
      this.isManageMode = isManageMode === true;

      const useIndexerForGovernance = getLocalStorageItem("useIndexerForGovernance");
      this.useIndexerForGovernance = useIndexerForGovernance === true;
    },
  },
});
