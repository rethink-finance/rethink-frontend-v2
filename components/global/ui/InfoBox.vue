<template>
  <div class="info">
    <Icon
      icon="material-symbols:info-outline"
      class="info__icon"
      width="1.5rem"
    />
    <span v-html="props.info" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  info: string;
}>();
</script>

<style lang="scss" scoped>
.info {
  display: flex;
  align-items: center;
  gap: 8px;

  width: 100%;
  padding: 16px;

  background-color: $color-gray-light-transparent;
  @include borderGray;

  font-size: 14px;
  font-weight: 400;

  &__icon {
    rotate: 180deg;
    color: var(--color-primary);
  }
}
</style>
