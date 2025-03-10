<script lang="ts" setup>
import { useOnboard } from "@web3-onboard/vue";
import { useAccountStore } from "~/store/account/account.store";

const accountStore = useAccountStore();

onMounted(() => {
  accountStore.web3Onboard = useOnboard();
  // if (useOnboard().alreadyConnectedWallets)
  //   accountStore.setAlreadyConnectedWallet();
});

watch(() => accountStore.connectedWallet?.provider, () => {
  console.log("Watcher: connected wallet changed");
  accountStore.setAlreadyConnectedWallet();
});

// Methods
useHead(() => {
  return {
    titleTemplate(titleChunk) {
      const title = titleChunk
      const siteTitle = "Rethnik Finance"

      let output = siteTitle

      switch (true) {
        case siteTitle === title:
          output = siteTitle
          break

        case Boolean(title):
          output = `${siteTitle} | ${title}`
          break
      }

      return output
    },
  }
})

</script>

<template>
  <NuxtLayout>
    <ClientOnly>
      <UiToast />
    </ClientOnly>

    <NuxtPage />
  </NuxtLayout>
</template>
