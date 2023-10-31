<template>
  <v-toolbar class="pa-1">
    <v-avatar size="80" rounded="0">
      <v-img cover :src="props.image"></v-img>
    </v-avatar>
    <v-card class="d-flex pa-1 transparent align-items-center">
      <div class="title-wrapper">
        <h4>{{ title }}</h4>
        <h5>{{ subtitle }}</h5>
      </div>
    </v-card>
  </v-toolbar>
</template>

<script setup lang="ts">
const props = defineProps({
  image: String,
  title: String,
  subtitle: String,
});
</script>

<style scoped>
.title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
