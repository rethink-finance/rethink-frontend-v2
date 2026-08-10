<template>
  <a
    v-if="props.link"
    :href="props.link"
    target="_blank"
    rel="noopener noreferrer"
    class="brand_note info"
  >
    <Icon
      icon="material-symbols:info-outline"
      class="brand_note__icon"
    />
    <span class="brand_note__body brand_note__text" v-html="props.info" />
  </a>

  <div v-else class="brand_note info">
    <Icon
      icon="material-symbols:info-outline"
      class="brand_note__icon"
    />
    <span
      class="brand_note__body brand_note__text"
      v-html="props.info"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  info: string;
  link?: string;
}>();
</script>

<style lang="scss" scoped>
/* The callout treatment itself is the shared .brand_note in
   assets/scss/overlays.scss — this only keeps the link's own affordances,
   since the whole box is clickable when a link is passed. */
.info {
  &[href]:hover {
    border-color: $color-line-3;
  }
}
</style>
