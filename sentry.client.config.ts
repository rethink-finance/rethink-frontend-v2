import * as Sentry from "@sentry/nuxt";

Sentry.init({
  dsn: process.env.NODE_ENV === "production" ? useRuntimeConfig().public.SENTRY_DSN as string : undefined,
  environment: process.env.NODE_ENV,
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 0.1,
});
