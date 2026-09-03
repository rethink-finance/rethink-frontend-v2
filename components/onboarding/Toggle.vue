<template>
  <button
    type="button"
    role="switch"
    class="toggle"
    :class="{ 'toggle--on': modelValue }"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="toggle__knob" />
  </button>
</template>

<script setup lang="ts">
/**
 * The create flow's switch. Vuetify's v-switch reserves a details row and a
 * ripple layer under a 40px track, which is taller than the card headers this
 * has to sit inside; the design's is a 32×18 track and nothing else.
 */
defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** What the switch controls, for anyone not reading the label beside it. */
  label: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);
</script>

<style scoped lang="scss">
.toggle {
  position: relative;
  flex: none;
  width: 32px;
  height: 18px;
  padding: 0;
  border: 1px solid $color-line-2;
  border-radius: 999px;
  background: $color-card-background;
  cursor: pointer;
  transition: background-color $default-transition-time ease,
    border-color $default-transition-time ease;

  &:focus-visible {
    outline: none;
    border-color: $color-accent-line;
  }

  &--on {
    border-color: $color-cyan-line;
    background: $color-cyan-tint;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  &__knob {
    position: absolute;
    top: 50%;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: $color-steel-blue;
    transform: translateY(-50%);
    transition: transform $default-transition-time ease,
      background-color $default-transition-time ease;
  }

  &--on &__knob {
    background: $color-cyan-raw;
    transform: translate(14px, -50%);
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    &__knob {
      transition: none;
    }
  }
}
</style>
