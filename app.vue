<script lang="ts" setup>
import { useOnboard } from "@web3-onboard/vue";
import { useAccountStore } from "~/store/account.store";

onMounted(() => {
  useAccountStore().web3Onboard = useOnboard();
  if (useOnboard().alreadyConnectedWallets)
    useAccountStore().setAlreadyConnectedWallet();
});
</script>
<!-- dummy commit -->

<template>
  <NuxtLayout>
    <ClientOnly>
      <UiToast />
    </ClientOnly>

    <NuxtPage />
  </NuxtLayout>
</template>
