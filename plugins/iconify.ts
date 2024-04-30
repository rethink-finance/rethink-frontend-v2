import { Icon } from "@iconify/vue";


export default defineNuxtPlugin((nuxtApp: any) => {
  nuxtApp.vueApp.component("Icon", Icon);
});
