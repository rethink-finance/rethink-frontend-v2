<template>
  <div class="text_badge" :class="{'text_badge--disabled': disabled}">
    {{ value }}
  </div>
</template>

<script setup lang="ts">
defineProps({
  value: {
    type: String,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped lang="scss">
.text_badge {
  display: flex;
  padding: 0.25rem;
  flex-direction: column;
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
}
</style>
