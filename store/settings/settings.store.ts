import { defineStore } from "pinia";

type AppTheme = "dark" | "light";
export type ThemePreference = AppTheme | "system";

interface IState {
    isManageMode: boolean;
    theme: AppTheme;
    themePreference: ThemePreference;
}

const systemTheme = (): AppTheme =>
  window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";

export const useSettingsStore = defineStore({
  id: "app-settings",
  state: (): IState => ({
    isManageMode: false,
    // The pre-paint head script (nuxt.config) has already resolved the stored
    // choice / OS preference onto <html data-theme>, so the store just reads
    // the verdict instead of re-deriving it. ssr is off, document exists.
    theme:
      typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "light"
        ? "light"
        : "dark",
    // What the user picked, as opposed to what is showing: no stored value
    // means "system", and only an explicit light/dark pick writes one.
    themePreference: (() => {
      const stored = getLocalStorageItem("theme", null);
      return stored === "light" || stored === "dark" ? stored : "system";
    })(),
  }),
  actions: {
    /**
     * A pick from the settings menu. "system" clears the stored choice and
     * follows the OS (live — see followSystemTheme); an explicit light/dark
     * persists and beats the OS preference from then on.
     */
    setThemePreference(preference: ThemePreference) {
      this.themePreference = preference;
      if (preference === "system") {
        clearLocalStorageItem("theme");
        this.applyTheme(systemTheme());
      } else {
        setLocalStorageItem("theme", preference);
        this.applyTheme(preference);
      }
    },
    /**
     * Restyles the document via the data-theme scope in tokens.scss and
     * flips Vuetify's own palette with it. Internal — callers pick through
     * setThemePreference so the stored choice stays consistent.
     */
    applyTheme(theme: AppTheme) {
      this.theme = theme;
      document.documentElement.dataset.theme = theme;
      const vuetify = useNuxtApp().$vuetify;
      vuetify.theme.global.name.value =
        theme === "light" ? "customLightTheme" : "customDarkTheme";
    },
    /**
     * Live OS-preference tracking while the choice is "system". Called once
     * from the navbar's onMounted; the listener stays for the page's life,
     * which is exactly the lifetime it needs.
     */
    followSystemTheme() {
      window
        .matchMedia("(prefers-color-scheme: light)")
        .addEventListener("change", () => {
          if (this.themePreference === "system") {
            this.applyTheme(systemTheme());
          }
        });
    },
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
