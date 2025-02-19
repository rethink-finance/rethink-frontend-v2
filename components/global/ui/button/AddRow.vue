<template>
  <v-btn
    variant="outlined"
    size="small"
    class="app_btn_small"
  >
    <template #prepend>
      <Icon
        icon="octicon:plus-16"
        height="1rem"
        width="1rem"
      />
    </template>
    <slot />
  </v-btn>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
</style>
