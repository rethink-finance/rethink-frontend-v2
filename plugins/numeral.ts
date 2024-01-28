import numeral from "numeral";

export default defineNuxtPlugin((nuxtApp) => {
  // You can alternatively use this format, which comes with automatic type support
  return {
    provide: {
      numeral,
    },
  }
});
