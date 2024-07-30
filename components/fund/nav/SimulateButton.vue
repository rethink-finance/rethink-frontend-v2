<template>
  <v-btn
    class="text-secondary"
    variant="outlined"
    @click="fundStore.refreshSimulateNAVCounter += 1"
  >
    Simulate NAV
  </v-btn>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
const fundStore = useFundStore();
</script>

<style lang="scss" scoped>
</style>
