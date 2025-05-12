<template>
  <v-breadcrumbs :items="items" class="breadcrumbs pa-0 mt-n4">
    <template #divider>
      <v-icon class="divider" icon="mdi-chevron-right" />
    </template>
    <template #prepend>
      <v-breadcrumbs-item
        v-if="prependBreadcrumb?.title && items.length > 0"
        :to="prependBreadcrumb?.to"
        class="prepend_breadcrumb"
      >
        <img

          :src="prependBreadcrumb?.photoUrl"
          class="avatar"
          alt="fund cover image"
        >
        <span>{{ prependBreadcrumb?.title }}</span>



      </v-breadcrumbs-item>

      <v-icon
        v-if="prependBreadcrumb?.title && items.length > 0"
        class="divider divider--prepend"
        icon="mdi-chevron-right"
      />
    </template>
  </v-breadcrumbs>
</template>

<script setup lang="ts">

import type BreadcrumbItem from "~/types/ui/breadcrumb";

defineProps<{
  items: BreadcrumbItem[],
  prependBreadcrumb?: BreadcrumbItem,
}>();
</script>

<style lang="scss" scoped>
.breadcrumbs {
 height: 1rem;

  :deep(.v-breadcrumbs-item--link) {
    color: $color-steel-blue;
    padding-inline: 0px;

    transition: color 0.3s ease;
  }
  :deep(.v-breadcrumbs-item--link:hover) {
    color: $color-text-irrelevant;
  }

}
:deep(.v-breadcrumbs-item--disabled) {
    opacity: 1;

    .v-breadcrumbs-item--link{
      color: $color-text-irrelevant;
    }
}

.prepend_breadcrumb {
  height: 1rem;


  :deep(.v-breadcrumbs-item--link) {
    display: flex;
    align-items: center;
  }
}
.avatar{
  width: 26px;
  height: 26px;
  border-radius: 50%;
  margin-right: 5px;
  object-fit: cover;
}
.divider{
  color: $color-steel-blue;
  font-size: $text-lg;

  &--prepend{
    margin-left: 8px;
    margin-right: 8px;
  }
}
</style>
