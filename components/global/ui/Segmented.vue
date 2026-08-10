<template>
  <div class="segmented">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      class="segmented__option"
      :class="{ 'segmented__option--active': option.key === modelValue }"
      @click="emit('update:modelValue', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * The design's segmented control: two or three mutually exclusive views of the
 * same data, shown side by side rather than hidden behind a menu.
 *
 * Shared because the app had grown three of these — the chart's series picker,
 * the composition card's pie/table switch, and now the portfolio's two — and
 * they had already drifted apart on which colour marks the active segment.
 */
export interface SegmentedOption {
  key: string;
  label: string;
}

defineProps<{
  modelValue: string;
  options: SegmentedOption[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

<style lang="scss" scoped>
.segmented {
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  overflow: hidden;

  &__option {
    padding: 0.375rem 0.875rem;
    font-size: 12px;
    font-weight: 600;
    color: $color-steel-blue;
    background: transparent;
    /* Labels wrap and clip without this — "Total value" is two words in a box
       sized to one. */
    white-space: nowrap;
    transition: color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:not(:first-child) {
      border-left: 1px solid $color-line-2;
    }

    &:hover {
      color: $color-white;
    }

    &--active {
      color: $color-cyan;
      background: $color-accent-soft;
    }
  }
}
</style>
