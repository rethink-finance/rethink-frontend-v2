<template>
  <UiButtonDetails>
    <v-icon
      v-if="isUndo"
      icon="mdi-arrow-u-left-top"
      color="secondary"
    />
    <v-icon
      v-else
      icon="mdi-delete-outline"
      color="error"
    />
  </UiButtonDetails>
</template>

<script setup lang="ts">
defineProps({
  isUndo: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped lang="scss">
</style>
