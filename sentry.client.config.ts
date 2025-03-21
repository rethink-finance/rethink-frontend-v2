import * as Sentry from "@sentry/nuxt";

Sentry.init({
  // If set up, you can use the Nuxt runtime config here
  // dsn: useRuntimeConfig().public.sentry.dsn, // modify, depending on your custom runtime config
  dsn: process.env.NODE_ENV === "production" ? useRuntimeConfig().public.SENTRY_DSN as string : undefined,
  environment: process.env.NODE_ENV,
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1,
});
