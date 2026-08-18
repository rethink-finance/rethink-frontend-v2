import { defineAsyncComponent } from "vue";

export default defineNuxtPlugin((nuxtApp) => {
  // One component renders charts (the vault page's NAV chart), so the library
  // — ApexCharts is the heaviest dependency in the app — has no business in
  // the entry bundle. Registered async, its chunk loads the first time an
  // <apexchart> actually renders; Discover and Portfolio never pay for it.
  nuxtApp.vueApp.component(
    "apexchart",
    defineAsyncComponent(() => import("vue3-apexcharts")),
  );
});
