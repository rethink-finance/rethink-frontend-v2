<template>
  <v-btn
    target="_blank"
    class="d-flex justify-space-between text-secondary"
    :to="to"
    :size="size"
    :variant="variant"
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
type Density = "compact" | "comfortable" | "default";
type Variant = "flat" | "text" | "elevated" | "tonal" | "plain";

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
    variant: {
      type: String as PropType<Variant>,
      default: "outlined",
    },
    density: {
      type: String as PropType<Density>,
      default: "default",
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
