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
    font-size: 16px;
    font-weight: bold;
    line-height: 1;
    color: $color-white;
  }
  &__subtitle {
    color: $color-text-irrelevant;
  }
}
</style>
