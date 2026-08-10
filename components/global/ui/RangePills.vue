<template>
  <div class="range_pills">
    <button
      v-for="range in ranges"
      :key="range"
      type="button"
      class="range_pills__pill"
      :class="{ 'range_pills__pill--active': range === modelValue }"
      :disabled="isDisabled(range)"
      @click="emit('update:modelValue', range)"
    >
      {{ range }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * How far back a chart looks. Shared by the vault's share price chart and the
 * portfolio's performance chart so the two never disagree on what a range
 * button looks like.
 *
 * `available` is optional: pass it where some windows hold too little history
 * to draw, and those pills say so rather than letting the click do nothing.
 */
const props = defineProps<{
  modelValue: string;
  ranges: string[];
  available?: Set<string>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const isDisabled = (range: string) =>
  props.available ? !props.available.has(range) : false;
</script>

<style lang="scss" scoped>
.range_pills {
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &__pill {
    padding: 0.4375rem 0.75rem;
    /* Transparent rather than absent, so a pill does not shift by a pixel as
       it becomes the active one. */
    border: 1px solid transparent;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    color: $color-steel-blue;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      color: $color-white;
    }

    &--active {
      color: $color-cyan;
      border-color: $color-accent-line;
      background: $color-accent-soft;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }
}
</style>
