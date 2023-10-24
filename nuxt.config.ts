import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  typescript: {
    shim: false,
  },

  build: {
    transpile: ["vuetify"],
  },

  css: ["vuetify/styles", "~/assets/scss/app.scss"],

  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        // @ts-expect-error
        config.plugins.push(
          vuetify({
            autoImport: true,
            styles: { configFile: "/assets/scss/vuetify.scss" },
          })
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
    "nuxt-icon",
  ],

  sourcemap: {
    server: false,
    client: false,
  },

  vite: {
    srr: { noExternal: ["vuetify"] },
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },

  plugins: ["~/plugins/vuetify.ts"],
});
