<template>
  <div
    class="details_button"
    :class="{
      'details_button--expanded': active,
      'details_button--disabled': disabled,
      'details_button--small': small,
      'details_button--xs': xs,
    }"
  >
    <span v-if="text" :class="active ? 'details_button--text-expanded' : ''">
      {{ text }}
    </span>
    <slot>
      <v-icon
        class="details_button__icon"
        :color="active ? 'primary' : ''"
        :icon="active ? 'mdi-menu-up' : 'mdi-menu-down'"
      />
    </slot>
  </div>
</template>

<script lang="ts">
export default defineComponent({
  name: "ButtonDetails",
  props: {
    text: {
      type: String,
      default: undefined,
    },
    active: {
      type: Boolean,
      default: false,
    },
    small: {
      type: Boolean,
      default: false,
    },
    xs: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
})
</script>

<style scoped lang="scss">
.details_button {
  @include borderGray;
  width: max-content;
  padding: 0.5rem 1rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  font-size: $text-xs;
  font-weight: 500;
  color: $color-text-irrelevant;
  z-index: 10;

  &:hover {
    cursor: pointer;
    background: $color-gray-light-transparent;
  }
  &__icon {
    margin-left: 0.5rem;
  }
  &--text_expanded{
    font-weight: 700;
    color: $color-white;
  }
  &--small {
    padding: 0.5rem;
  }
  &--xs {
    padding: 0.25rem;
    height: auto;
  }
  &--disabled {
    opacity: 0.65;
  }
  &--expanded {
    background-color: $color-background-button;
  }
}
</style>
