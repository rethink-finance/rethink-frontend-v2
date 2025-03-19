import * as Sentry from "@sentry/nuxt";

// Add a sentry.client.config.ts file to the root of your project:
Sentry.init({
  // If set up, you can use the Nuxt runtime config here
  // dsn: useRuntimeConfig().public.sentry.dsn, // modify, depending on your custom runtime config
  dsn: useRuntimeConfig().public.sentry.dsn as string,
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
});
