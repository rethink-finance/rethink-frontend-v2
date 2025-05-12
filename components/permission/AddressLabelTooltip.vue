<template>
  <v-tooltip
    activator="parent"
    location="right"
  >
    <strong
      v-if="label"
    >
      {{ label }}
    </strong>
    <div>
      {{ address }}
    </div>
  </v-tooltip>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
  },
});
</script>
