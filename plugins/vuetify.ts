import "@mdi/font/css/materialdesignicons.css";
import "@/assets/scss/vuetify.scss";
import { createVuetify, ThemeDefinition } from "vuetify";
import { md2 } from "vuetify/blueprints";

const customDarkTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#111C35",
    surface: "#060816",
    primary: "#205FFF",
    "primary-darken-1": "#101A2F",
    secondary: "#AEC5FF",
    "secondary-darken-1": "#018786",
    error: "#DE3838",
    info: "#2196F3",
    success: "#38DE38",
    warning: "#FB8C00",
  },
};

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    // ... your configuration goes here
    ssr: true,
    blueprint: md2,
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
