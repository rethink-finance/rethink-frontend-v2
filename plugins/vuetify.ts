import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify, ThemeDefinition } from "vuetify";
import { md3 } from "vuetify/blueprints";

const customDarkTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    primary: "#6200EE",
    "primary-darken-1": "#3700B3",
    secondary: "#03DAC6",
    "secondary-darken-1": "#018786",
    error: "#B00020",
    info: "#2196F3",
    success: "#4CAF50",
    warning: "#FB8C00",
  },
};

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    // ... your configuration goes here
    ssr: true,
    blueprint: md3,
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
  app.vueApp.use(vuetify);
});
