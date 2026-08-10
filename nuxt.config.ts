import { nodePolyfills } from "vite-plugin-node-polyfills";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // TODO set to true in production.
  ssr: false,
  app: {
    head: {
      // Default tab title. Vault detail pages override it with
      // "<SYMBOL> - <Vault name>" via useSeoMeta (FundSEOMetadata.vue).
      title: "rethink.finance",
      link: [
        // Same favicon set as the rethink.finance homepage.
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon-512.png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        // Brand fonts — same sources as rethink.finance homepage.
        { rel: "preconnect", href: "https://api.fontshare.com" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap",
        },
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
  // In build mode, vite-plugin-checker runs vue-tsc by string-joining its
  // arguments into a shell command without quoting them. Nuxt hands it an
  // absolute path to tsconfig.json, so on any checkout living under a
  // directory with a space in its name the shell splits that path and tsc
  // aborts with "TS5042: Option 'project' cannot be mixed with source files"
  // before compiling a thing. Still unfixed upstream as of 0.14.5.
  //
  // So: no checker during the build. Types are still checked on every build
  // through the `typecheck` script, which goes via `nuxt typecheck` — that
  // one spawns vue-tsc directly with an argument array and no shell, so the
  // path never gets re-parsed. Dev keeps its live checker (the watcher runs
  // in-process and never shells out).
  $production: {
    typescript: {
      typeCheck: false,
    },
  },
  build: {
    transpile: ["vuetify"],
  },
  css: [
    "vuetify/styles",
    "~/assets/scss/vuetify_overrides.scss",
    "~/assets/scss/app.scss",
    "~/assets/scss/overlays.scss",
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
      // Backend URL for API calls
      BACKEND_URL: process.env.BACKEND_URL || "http://localhost:8000",
      // Explorers for loading ABIs
      ETHERSCAN_KEY: process.env.ETHERSCAN_KEY,
      POLYGONSCAN_KEY: process.env.POLYGONSCAN_KEY,
      ARBISCAN_KEY: process.env.ARBISCAN_KEY,
      BASESCAN_KEY: process.env.BASESCAN_KEY,
      // Localhost explorer
      TRY_ETHERNAL_KEY: process.env.TRY_ETHERNAL_KEY,
      GOVERNABLE_FUND_FACTORY_BEACON: process.env.GOVERNABLE_FUND_FACTORY_BEACON,
      GOVERNABLE_FUND_FACTORY_PROXY: process.env.GOVERNABLE_FUND_FACTORY_PROXY,
      WRAPPED_TOKEN_FACTORY_ADDRESS: process.env.WRAPPED_TOKEN_FACTORY_ADDRESS,
      NAV_CALCULATOR_BEACON: process.env.NAV_CALCULATOR_BEACON,
      NAV_CALCULATOR_PROXY: process.env.NAV_CALCULATOR_PROXY,
      NAV_EXECUTOR_BEACON: process.env.NAV_EXECUTOR_BEACON,
      NAV_EXECUTOR_PROXY: process.env.NAV_EXECUTOR_PROXY,
      RETHINK_FUND_GOVERNOR_BEACON: process.env.RETHINK_FUND_GOVERNOR_BEACON,
      POOL_PERFORMANCE_FEE_BEACON: process.env.POOL_PERFORMANCE_FEE_BEACON,
      POOL_PERFORMANCE_FEE_PROXY: process.env.POOL_PERFORMANCE_FEE_PROXY,
      GOVERNABLE_FUND_BEACON: process.env.GOVERNABLE_FUND_BEACON,
      ROLES_V1_SINGLETON: process.env.ROLES_V1_SINGLETON,
      ZODIAC_ROLES_V1_BEACON: process.env.ZODIAC_ROLES_V1_BEACON,
      SAFE_SINGLETON: process.env.SAFE_SINGLETON,
      SAFE_PROXY_FACTORY: process.env.SAFE_PROXY_FACTORY,
      RETHINK_READER: process.env.RETHINK_READER,
      GOVERNABLE_FUND_FLOWS_BEACON: process.env.GOVERNABLE_FUND_FLOWS_BEACON,
      GOVERNABLE_FUND_NAV_BEACON: process.env.GOVERNABLE_FUND_NAV_BEACON,
      CONTRACT_FACTORY_BEACON: process.env.CONTRACT_FACTORY_BEACON,
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
    // Dev-only proxy so the frontend can talk to the production backend
    // from localhost without CORS (the backend only allows the
    // app.rethink.finance origin). Point BACKEND_URL at
    // http://localhost:3000/backend-api to use it. No effect on builds.
    devProxy: {
      "/backend-api": {
        target: "https://backend.rethink.finance",
        changeOrigin: true,
      },
    },
  },
  compatibilityDate: "2024-08-20",
});
