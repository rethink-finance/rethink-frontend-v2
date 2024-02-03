<script lang="ts" setup>
import { useOnboard } from "@web3-onboard/vue";
import { useAccountsStore } from "~/store/modules/accounts.store";

onMounted(() => {
  useAccountsStore().web3Onboard = useOnboard();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
