import { defineNuxtRouteMiddleware, navigateTo } from "nuxt/app";

export default defineNuxtRouteMiddleware((to) => {
  // Check if the current route is already the target
  if (to.path !== "/details/0x89-SOON1-0xc748d5E77B998608Ef84d063b9694f2dBB81a325") {
    return navigateTo("/details/0x89-SOON1-0xc748d5E77B998608Ef84d063b9694f2dBB81a325");
  }
});
