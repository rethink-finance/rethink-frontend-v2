<template>
  <div class="main_card">
    <div v-if="title || subtitle"  class="header">
      <div class="header__title-col">
        <div
          v-if="title"
          class="header__title subtitle_white"
        >
          {{ title }}
        </div>
        <div
          v-if="subtitle"
          class="header__sub-title"
        >
          {{ subtitle }}
        </div>
      </div>
      <slot name="header-right" />
    </div>
    <div v-if="hasTools" class="tools">
      <slot name="tools" />
    </div>
    <slot />
  </div>
</template>

<script lang="ts">
export default {
  props: {
    title: {
      type: String,
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
    },
  },
  computed: {
    hasTools(): boolean {
      // Check if tools slot content is present
      return !!this.$slots.tools;
    },
  },
};
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;

  @include sm {
    flex-direction: row;
  }

  &__title-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__sub-title {
    font-size: $text-sm;
    color: $color-text-irrelevant;
    font-weight: 500;
  }
}

.tools {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;
}
</style>
