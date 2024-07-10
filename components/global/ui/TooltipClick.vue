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
/**
 * TooltipClick component definition.
 * @component TooltipClick
 * @description A Vue component that shows a tooltip on click.
 *
 * TooltipClick component props.
 * @property {string} tooltipText - The text to display in the tooltip.
 * @property {number} [hideAfter=1000] - Milliseconds after which tooltip hides automatically.
 * @property {"top" | "bottom" | "left" | "right"} [location="top"] - The position of the tooltip relative to the activator.
 */

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
      if (props.tooltipText === "") {
        return;
      }

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
