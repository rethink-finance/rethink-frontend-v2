/**
 * monitoring.rethink.finance serves the same build as app.rethink.finance; a
 * visitor landing on that host's root wants the monitoring page, not
 * Discover. Every other path stays as it is, so links into the app keep
 * working from either host.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith("monitoring.") && to.path === "/") {
    return navigateTo("/monitoring", { replace: true });
  }
});
