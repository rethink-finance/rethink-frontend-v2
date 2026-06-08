import "@mdi/font/css/materialdesignicons.css";
import { createVuetify, type ThemeDefinition } from "vuetify";
import { md2 } from "vuetify/blueprints";

// TODO use colors from _variables.scss, convert to var(--color-primary)
const customDarkTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#0C0D12",
    surface: "#12141C",
    primary: "#1F5FFF",
    "primary-darken-1": "#1747C9",
    secondary: "#D2DFFF",
    "secondary-darken-1": "#8E97AD",
    error: "#E66A60",
    info: "#16C8FF",
    success: "#38DE38",
    warning: "#FB8C00",
  },
};

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    // ... your configuration goes here
    ssr: true,
    blueprint: md2,
    aliases: {

    },
    defaults: {
      global: {
        ripple: false,
      },
    },
    theme: {
      defaultTheme: "customDarkTheme",
      themes: {
        customDarkTheme,
      },
    },
  });
  nuxtApp.vueApp.use(vuetify);
});
