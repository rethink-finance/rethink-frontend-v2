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
import { useToastStore } from "~/store/toasts/toast.store";

export default {
  name: "CopyButton",
  props: {
    title: {
      type: String,
      default: "",
    },
    value: {
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
    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(this.value);
        // const msg = "Copied Fund Address (" + this.fund.address + ") to clipboard";
        // this.$toast.success(msg);
        this.toastStore.addToast(`Copied to clipboard: ${this.value}.`);
      } catch ($e) {console.error($e);}
    },
  },
}
</script>

<style scoped lang="scss">

</style>
