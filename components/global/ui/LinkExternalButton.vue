<template>
  <v-btn
    target="_blank"
    class="d-flex justify-space-between text-secondary"
    variant="outlined"
    :to="to"
    :size="size"
    :density="density"
    :active="false"
  >
    {{ title }}
    <template #append>
      <v-icon icon="mdi-link" size="1.5rem" />
    </template>
    <v-tooltip v-if="showTooltip && to" activator="parent" location="bottom">
      {{ to }}
    </v-tooltip>
  </v-btn>
</template>

<script lang="ts">

export default {
  name: "LinkExternalButton",
  props: {
    title: {
      type: String,
      default: "",
    },
    to: {
      type: String,
      default: "",
    },
    size: {
      type: String,
      default: "default",
    },
    density: {
      type: String,
      default: "default", // "compact" | "comfortable" | "default"
    },
    showTooltip: {
      type: Boolean,
      default: true,
    },
  },
}
</script>

<style scoped lang="scss">

</style>
