<template>
  <a
    v-if="props.link"
    :href="props.link"
    target="_blank"
    rel="noopener noreferrer"
    class="info"
  >
    <Icon
      icon="material-symbols:info-outline"
      class="info__icon"
      width="1.5rem"
    />
    <span class="info__text" v-html="props.info" />
  </a>

  <div v-else class="info">
    <Icon
      icon="material-symbols:info-outline"
      class="info__icon"
      width="1.5rem"
    />
    <span
      class="info__text"
      v-html="props.info"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  info: string;
  link?: string;
}>();
</script>

<style lang="scss" scoped>
.info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 1rem;
  background-color: $color-gray-light-transparent;
  @include borderGray;
  font-size: $text-sm;
  font-weight: 400;

  &__icon {
    rotate: 180deg;
    color: var(--color-primary);
    width: 30px;
  }
  &__text{
    width: calc(100% - 30px);
    :deep(a){
      color: var(--color-primary);
    }
  }
}
</style>
