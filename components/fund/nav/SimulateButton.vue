<template>
  <v-btn
    class="text-secondary"
    variant="outlined"
    @click="handleSimulateNav"
  >
    Simulate NAV
  </v-btn>
</template>

<script setup lang="ts">
import { defineEmits } from "vue";
const emit = defineEmits(["simulateNAV"]);

const handleSimulateNav = () => {
  emit("simulateNAV");
};
</script>

<style lang="scss" scoped>
</style>
