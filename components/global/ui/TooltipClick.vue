<template>
  <v-tooltip
    v-model="show"
    :open-on-hover="false"
    :location="location"
    class="tooltip"
  >
    <template #activator="{ props }">
      <div v-bind="props" @click="handleClick">
        <slot />
      </div>
    </template>

    <slot name="tooltip" />
  </v-tooltip>
</template>

<script lang="ts">
/**
 * TooltipClick component definition.
 * @component TooltipClick
 * @description A Vue component that shows a tooltip on click.
 *
 * TooltipClick component props.
 * @property {number} [hideAfter=1000] - Milliseconds after which tooltip hides automatically.
 * @property {"top" | "bottom" | "left" | "right"} [location="top"] - The position of the tooltip relative to the activator.
 */

export default defineComponent({
  name: "TooltipClick",
  props: {
    hideAfter: {
      type: Number,
      default: 1000,
    },
    location: {
      type: String as PropType<"top" | "bottom" | "left" | "right">,
      default: "top",
    },
    showTooltip: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { slots }) {
    const show = ref(false);
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const handleClick = () => {
      console.log("showTooltip", props.showTooltip);
      if (!props.showTooltip) {
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
      handleClick,
    };
  },
});
</script>

<style scoped lang="scss"></style>
