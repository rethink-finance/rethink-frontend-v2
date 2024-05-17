<template>
  <div class="details_button" :class="{'details_button--expanded': active}">
    <span :class="active ? 'details_button--text-expanded' : ''">
      Details
    </span>
    <v-icon
      class="details_button__icon"
      :color="active ? 'primary' : ''"
      :icon="active ? 'mdi-menu-up' : 'mdi-menu-down'"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
  name: "DetailsButton",
  props: {
    active: {
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
  &--text_expanded{
    font-weight: 700;
    color: $color-white;
  }
  &__expanded{
    background-color: $color-background-button;
  }
  &__icon {
    margin-left: 0.5rem;
  }
}
</style>
