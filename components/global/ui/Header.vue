<template>
  <div class="main_header">
    <slot />
  </div>
</template>

<style lang="scss">
.main_header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  &__title {
    font-size: $text-xl;
    color: $color-title;
    font-weight: 500;
    letter-spacing: $letter-spacing-lg;
  }
  &__subtitle {
    color: $color-text-irrelevant;
  }
}
</style>
