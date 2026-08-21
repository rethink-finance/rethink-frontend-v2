<template>
  <span class="info_tooltip" tabindex="0" :aria-label="text">
    <!-- The design's circled-i, verbatim. -->
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
    <v-tooltip
      activator="parent"
      :location="location"
      :max-width="250"
      content-class="info_tooltip__panel"
    >
      <slot>{{ text }}</slot>
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
/**
 * An info mark with the explainer sentence behind it — the design's
 * replacement for helper paragraphs sitting permanently under a control.
 * The bubble is the app's standard tooltip overlay; only the type inside is
 * restyled (see info_tooltip__panel in overlays.scss).
 */
type TooltipSide = "top" | "bottom" | "start" | "end";

defineProps({
  /** The hint itself. A slot overrides it when the text needs markup. */
  text: {
    type: String,
    default: "",
  },
  /** Which side of the mark the bubble opens on. */
  location: {
    type: String as PropType<TooltipSide>,
    default: "top",
  },
  /** Rendered icon size in px — the settle row's mark runs one up. */
  size: {
    type: Number,
    default: 13,
  },
});
</script>

<style scoped lang="scss">
.info_tooltip {
  display: inline-flex;
  flex: none;
  align-items: center;
  color: $color-steel-blue;
  cursor: help;
  transition: color $default-transition-time ease;

  svg {
    display: block;
  }

  &:hover,
  &:focus-visible {
    color: $color-white;
  }

  &:focus-visible {
    outline: 1px solid $color-accent-line;
    outline-offset: 2px;
    border-radius: $default-border-radius;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
