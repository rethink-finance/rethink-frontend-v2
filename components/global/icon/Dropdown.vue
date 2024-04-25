<template>
  <Icon
    class="dropdown_icon"
    :class="{'dropdown_icon--active': active}"
    icon="octicon:triangle-down-16"
    width="2rem"
  />
</template>

<script setup lang="ts">
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

</script>

<style lang="scss" scoped>
.dropdown_icon {
  &:deep(*) {
   fill: $color-subtitle;
  }
  &--active {
    transform: rotate(180deg);
  }
  &--active:deep(*) {
    fill: $color-primary;
  }
}
</style>
