<template>
  <v-tooltip v-model="show" :open-on-hover="false" :location="location">
    <template v-slot:activator="{ props }">
      <div v-bind="props" @click="showTooltip">
        <slot />
      </div>
    </template>
    <span>{{ tooltipText }}</span>
  </v-tooltip>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, ref } from "vue";

export default defineComponent({
  name: "TooltipClick",
  props: {
    tooltipText: {
      type: String,
      default: "",
    },
    hideAfter: {
      type: Number,
      default: 1000,
    },
    location: {
      type: String as PropType<"top" | "bottom" | "left" | "right">,
      default: "top",
    },
  },
  setup(props) {
    const show = ref(false);
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const showTooltip = () => {
      show.value = true;
      if (timerId) {
        clearTimeout(timerId); // Clear any existing timer
      }
      timerId = setTimeout(() => {
        show.value = false;
      }, props.hideAfter);
    };

    onBeforeUnmount(() => {
      if (timerId) {
        clearTimeout(timerId);
      }
    });
    return {
      show,
      showTooltip,
    };
  },
});
</script>

<style scoped lang="scss"></style>
