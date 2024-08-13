<template>
  <v-breadcrumbs :items="items" class="breadcrumbs pa-0 mt-n4">
    <template #divider>
      <v-icon icon="mdi-chevron-left" />
    </template>
  </v-breadcrumbs>
</template>

<script setup lang="ts">

import type BreadcrumbItem from "~/types/ui/breadcrumb";

defineProps<{
  items: BreadcrumbItem[]
}>();
</script>

<style lang="scss" scoped>
.breadcrumbs {
 height: 1rem;
}
</style>
