<template>
  <div
    class="text_badge"
    :class="{
      'text_badge--disabled': disabled,
      'text_badge--bold': bold,
      'text_badge--uppercase': uppercase,
    }"
    :style="{ color: color }"
  >
    <slot>
      {{ value }}
    </slot>
  </div>
</template>

<script setup lang="ts">
defineProps({
  value: {
    type: String,
    default: undefined,
  },
  color: {
    type: String,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  bold: {
    type: Boolean,
    default: false,
  },
  uppercase: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped lang="scss">
.text_badge {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  padding: 0.25rem;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  width: max-content;
  color: $color-text-irrelevant;

  @include borderGray;
  background: $color-badge-navy;

  &--disabled {
    opacity: 0.65;
  }
  &--bold {
    font-weight: 800;
  }
  &--uppercase {
    text-transform: uppercase;
  }
}
</style>
