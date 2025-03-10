<template>
  <div class="seo">

    <h1 v-if="oivName" class="oivName">
      {{ oivName }}
    </h1>

    <div v-if="description" class="description">
      {{ description }}
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
const props = defineProps(
  {
    oivName: {
      type: String,
      default: "",
    },
    symbol: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
  },
)

// Token Symbol - OIV Name
const parsedTitle = computed(() => {
  return props.symbol ? `${props.symbol} - ${props.oivName}` : props.oivName
})

useSeoMeta({
  title: () => parsedTitle.value,
  ogTitle: () => parsedTitle.value,
  description: () => props.description,
  ogDescription: () => props.description,
  ogImage: () => props.imageUrl,
})
</script>

<style scoped>
.seo {
    display: none;
}
</style>
