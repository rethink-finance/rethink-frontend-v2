<template>
  <div class="sort">
    <Icon
      class="sort__arrow"
      :class="{'sort__arrow--active': isArrowActive('asc')}"
      name="IconSortArrowUp"
      size="0.75rem"
    />
    <Icon
      class="sort__arrow"
      :class="{'sort__arrow--active': isArrowActive('desc')}"
      name="IconSortArrowDown"
      size="0.75rem"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  sort: {
    type: [String, Boolean],
    default: false,
  },
});

function isArrowActive(key: string) {
  return props.sort === key;
}
</script>

<style lang="scss" scoped>
.sort {
  display: flex;
  flex-direction: column;

  &__arrow {
    &:deep(*) {
     fill: $color-subtitle;
    }
    &--active:deep(*) {
      fill: $color-white;
    }
  }
}
</style>
