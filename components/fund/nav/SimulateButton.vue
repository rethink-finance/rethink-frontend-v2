<template>
  <v-tooltip text="Refresh Simulated NAV" location="top">
    <template #activator="{ props }">
      <Icon
        icon="mdi-update"
        class="icon"
        v-bind="props"
        @click="fundStore.refreshSimulateNAVCounter += 1"
      />
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
const fundStore = useFundStore();
</script>
<style lang="scss">
.icon{
  cursor: pointer;
  color: $color-steel-blue;
  font-size: 1.5rem;
}
</style>
