<template>
  <v-btn
    class="d-flex justify-space-between text-secondary"
    variant="outlined"
    :size="size"
    @click="copyToClipboard"
  >
    {{ title }}
    <template #append>
      <v-icon icon="mdi-link" size="1.5rem" />
    </template>
    <v-tooltip v-if="tooltipText" activator="parent" location="bottom">
      {{ tooltipText }}
    </v-tooltip>
  </v-btn>
</template>

<script lang="ts">
import { useToastStore } from "~/store/toast.store";

export default {
  name: "CopyButton",
  props: {
    title: {
      type: String,
      default: "",
    },
    tooltipText: {
      type: String,
      default: "",
    },
    size: {
      type: String,
      default: "default",
    },
  },
  setup() {
    const toastStore = useToastStore();
    return {
      toastStore,
    }
  },
  methods: {
    copyToClipboard() {
      this.toastStore.addToast("Copied to clipboard.");
    },
  },
}
</script>

<style scoped lang="scss">

</style>
