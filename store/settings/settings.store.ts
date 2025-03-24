import { defineStore } from "pinia";

interface IState {
    isManageMode: boolean;
}

export const useSettingsStore = defineStore({
  id: "app-settings",
  state: (): IState => ({
    isManageMode: false,

  }),
  actions: {
    toggleAdvancedMode() {
      setLocalStorageItem("isManageMode", this.isManageMode);
    },
    // load advanced mode from local storage and set it to the store
    loadAdvancedMode() {
      const storedValue = getLocalStorageItem("isManageMode");

      if (storedValue === true) {
        this.isManageMode = true;
      } else {
        this.isManageMode = false;
      }
    },
  },
});
