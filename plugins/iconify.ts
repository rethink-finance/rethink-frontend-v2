import { Icon, addIcon } from "@iconify/vue";
import weth from "@/assets/images/icons/weth.svg?raw";
import hyperevm from "@/assets/images/icons/hyperevm.svg?raw";


export default defineNuxtPlugin((nuxtApp: any) => {
  nuxtApp.vueApp.component("Icon", Icon);

  // TODO generalize this code when needed to parse and add all icons in the icons dir
  // Extract only the inner <path> etc.
  const inner = weth
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");

  addIcon("custom:weth", {
    body: inner,
    width: 70,  // match original viewBox
    height: 70,
  });

  const hyperevmInner = hyperevm
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");

  addIcon("custom:hyperevm", {
    body: hyperevmInner,
    width: 512,  // match original viewBox
    height: 512,
  });
});
