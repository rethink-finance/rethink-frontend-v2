<script lang="ts" setup>
import { useOnboard } from "@web3-onboard/vue";
import { useAccountStore } from "~/store/account.store";

const accountStore = useAccountStore();

onMounted(() => {
  accountStore.web3Onboard = useOnboard();
  // if (useOnboard().alreadyConnectedWallets)
  //   accountStore.setAlreadyConnectedWallet();
});

watch(() => accountStore.connectedWallet, () => {
  console.log("Watcher: connected wallet changed");
  accountStore.setAlreadyConnectedWallet();
});

</script>

<template>
  <NuxtLayout>
    <ClientOnly>
      <UiToast />
    </ClientOnly>

    <NuxtPage />
  </NuxtLayout>
</template>
