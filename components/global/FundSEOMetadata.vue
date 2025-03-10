<template>
  <div class="fund_seo_metadata">
    <h1 v-if="fundName">
      {{ fundName }}
    </h1>

    <div v-if="description">
      {{ description }}
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
const props = defineProps(
  {
    fundName: {
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
  return props.symbol ? `${props.symbol} - ${props.fundName}` : props.fundName
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
.fund_seo_metadata {
    display: none;
}
</style>
