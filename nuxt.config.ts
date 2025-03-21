import { nodePolyfills } from "vite-plugin-node-polyfills";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

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
      ENV_EXCLUDE_TEST_FUNDS: process.env.ENV_EXCLUDE_TEST_FUNDS !== "false",  // default value is true
      // Rethink Subgraph
      GRAPH_BASE_URL: process.env.GRAPH_BASE_URL,
      GRAPH_USERID: process.env.GRAPH_USERID,
      GRAPH_VERSION: process.env.GRAPH_VERSION,
      // Zodiac Subgraph
      ZODIAC_GRAPH_BASE_URL: process.env.ZODIAC_GRAPH_BASE_URL,
      ZODIAC_GRAPH_SEPOLIA: process.env.ZODIAC_GRAPH_SEPOLIA,
      ZODIAC_GRAPH_GNOSIS_CHAIN: process.env.ZODIAC_GRAPH_GNOSIS_CHAIN,
      ZODIAC_GRAPH_ETHEREUM: process.env.ZODIAC_GRAPH_ETHEREUM,
      ZODIAC_GRAPH_POLYGON: process.env.ZODIAC_GRAPH_POLYGON,
      ZODIAC_GRAPH_ARBITRUM: process.env.ZODIAC_GRAPH_ARBITRUM,
      ZODIAC_GRAPH_OPTIMISM: process.env.ZODIAC_GRAPH_OPTIMISM,
      ZODIAC_GRAPH_AVALANCHE: process.env.ZODIAC_GRAPH_AVALANCHE,
      ZODIAC_GRAPH_BSC: process.env.ZODIAC_GRAPH_BSC,
      ZODIAC_GRAPH_BASE: process.env.ZODIAC_GRAPH_BASE,
      // Explorers for loading ABIs
      ETHERSCAN_KEY: process.env.ETHERSCAN_KEY,
      POLYGONSCAN_KEY: process.env.POLYGONSCAN_KEY,
      ARBISCAN_KEY: process.env.ARBISCAN_KEY,
      BASESCAN_KEY: process.env.BASESCAN_KEY,
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
    "plugins/explorer.ts",
    "plugins/iconify.ts",
    "plugins/apexcharts.client.ts",
    "plugins/numeral.ts",
    "plugins/web3-onboard.ts",
    "plugins/apollo.ts",
    "plugins/localforage.ts",
    "plugins/init-app-settings.client.ts",
  ],
  nitro: {
    prerender: {
      failOnError: false,
    },
  },
  compatibilityDate: "2024-08-20",
});

