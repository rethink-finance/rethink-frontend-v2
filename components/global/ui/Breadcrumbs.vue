<template>
  <v-breadcrumbs :items="items">
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
