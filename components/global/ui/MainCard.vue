<template>
  <div class="main_card">
    <div class="header">
      <div class="header__title-col">
        <div class="header__title">{{ title }}</div>
        <div class="header__sub-title">{{ subtitle }}</div>
      </div>
      <slot name="header-right" />
    </div>
    <div class="tools" v-if="hasTools">
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
      defautlt: "",
    },
    subtitle: {
      type: String,
      defautlt: "",
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
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__title-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__title {
    font-size: $text-md;
    color: $color-white;
    font-weight: 700;
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
