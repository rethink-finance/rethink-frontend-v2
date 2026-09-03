import "@mdi/font/css/materialdesignicons.css";
import { createVuetify, type ThemeDefinition } from "vuetify";
import { md2 } from "vuetify/blueprints";

// Mirrors of assets/scss/tokens.scss for the places Vuetify injects color
// itself (rgb(var(--v-theme-*)) usages, the app bar's color="background").
// Literal hexes because Vuetify derives on/lighten/darken shades from them
// at setup time, which a var() reference can't feed.
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
    success: "#3ED598",
    warning: "#FB8C00",
  },
};

const customLightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    primary: "#1F5FFF",
    "primary-darken-1": "#1747C9",
    secondary: "#33436E",
    "secondary-darken-1": "#26355C",
    error: "#BE4A40",
    info: "#087AAB",
    success: "#0C7D56",
    warning: "#8A6D00",
  },
};

/**
 * The head script in nuxt.config resolves the theme (localStorage choice,
 * else OS preference) onto <html data-theme> before first paint; Vuetify just
 * has to agree with it at startup. Later switches go through
 * useSettingsStore's theme action, which flips both.
 */
const initialTheme = () => {
  if (typeof document !== "undefined") {
    return document.documentElement.dataset.theme === "light"
      ? "customLightTheme"
      : "customDarkTheme";
  }
  return "customDarkTheme";
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
      defaultTheme: initialTheme(),
      themes: {
        customDarkTheme,
        customLightTheme,
      },
    },
  });
  nuxtApp.vueApp.use(vuetify);
  // Exposed as $vuetify so the settings store can switch themes at runtime.
  return {
    provide: {
      vuetify,
    },
  };
});
