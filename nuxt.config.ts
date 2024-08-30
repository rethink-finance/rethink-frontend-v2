import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // TODO set to true in production.
  ssr: false,
  app: {
    head: {
      title: "Rethink Finance | Run Funds On-Chain",
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" },
      ],
    },
    // baseURL: '/rethink-frontend-v2/',
    buildAssetsDir: "assets",
  },
  //  generate: {
  //    nojekyll: true,
  // },
  devtools: { enabled: false },
  typescript: {
    typeCheck: true,
    strict: true,
  },
  build: {
    transpile: ["vuetify"],
  },
  css: [
    "vuetify/styles",
    "~/assets/scss/vuetify_overrides.scss",
    "~/assets/scss/app.scss",
  ],
  runtimeConfig: {
    public: {
      WALLET_CONNECT_PROJECT_ID: process.env.WALLET_CONNECT_PROJECT_ID,
      BASE_DOMAIN: process.env.BASE_DOMAIN,
    },
  },
  routeRules: {
    //  '/': {prerender: false},
    //  '/create': {prerender: false},
    //  '/governance': {prerender: false},
  },
  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config: any) => {
        config.plugins.push(
          vuetify({
            autoImport: true,
          }),
        );
      });
    },
    [
      "@nuxtjs/google-fonts",
      {
        families: {
          Roboto: true,
          Inter: [100, 200, 300, 400, 500, 600, 700],
          "Josefin+Sans": true,
          Lato: [100, 300],
          Raleway: {
            wght: [100, 400],
            ital: [100],
          },
          download: false,
          useStylesheet: true,
        },
      },
    ],
    "@pinia/nuxt",
    "@nuxt/test-utils/module",
  ],
  sourcemap: {
    server: false,
    client: false,
  },
  vite: {
    ssr: { noExternal: ["vuetify"] },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: "@import \"@/assets/scss/_variables.scss\";" +
            "@import \"@/assets/scss/_mixins.scss\";" +
            "@import \"@/assets/scss/_typography.scss\";",
        },
      },
    },
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    plugins: [
      nodePolyfills(),
    ],
  },
  plugins: [
    "plugins/iconify.ts",
    "plugins/apexcharts.client.ts",
    "plugins/numeral.ts",
    "plugins/web3-onboard.ts",
  ],
  nitro: {
    prerender: {
      failOnError: false,
    },
  },
  compatibilityDate: "2024-08-20",
});

