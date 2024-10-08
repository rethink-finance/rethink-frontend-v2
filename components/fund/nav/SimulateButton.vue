<template>
  <v-tooltip text="Refresh Simulated NAV" location="top">
    <template #activator="{ props }">
      <Icon
        icon="mdi-update"
        @click="fundStore.refreshSimulateNAVCounter += 1"
        class="icon"
        v-bind="props"
      />
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
const fundStore = useFundStore();
</script>
<style lang="scss">
.icon{
  cursor: pointer;
  color: $color-steel-blue;
  font-size: 24px;
}
</style>