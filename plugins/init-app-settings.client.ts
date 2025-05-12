import { useSettingsStore } from "~/store/settings/settings.store";

export default defineNuxtPlugin(() => {
  const uiSettingsStore = useSettingsStore();
  uiSettingsStore.loadAdvancedMode();
});
