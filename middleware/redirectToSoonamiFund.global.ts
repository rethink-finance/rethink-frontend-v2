import { defineNuxtRouteMiddleware, navigateTo } from "nuxt/app";

const SOONAMI_FUND_ADDRESS = "0xaC3D76E29f866702E17f571cccb15937E5A17303";
export const SOONAMI_FUND_DETAILS_URL = `/details/0x1-sniETH-${SOONAMI_FUND_ADDRESS}`;

export default defineNuxtRouteMiddleware((to) => {
  // Check if the current route is already the target
  if (to.path !== SOONAMI_FUND_DETAILS_URL) {
    return navigateTo(SOONAMI_FUND_DETAILS_URL);
  }
});
