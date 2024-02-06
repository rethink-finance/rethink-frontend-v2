<script lang="ts" setup>
import { useOnboard } from "@web3-onboard/vue";
import { useAccountsStore } from "~/store/accounts.store";

onMounted(() => {
  useAccountsStore().web3Onboard = useOnboard();
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
