<template>
  <div class="data_bar">
    <div v-if="title" class="data_bar__title">
      {{ title }}
    </div>
    <template class="data_bar__body">
      <slot name="default" />
    </template>
  </div>
</template>

<script lang="ts">
export default defineComponent({
  name: "DataBar",
  props: {
    title: {
      type: String,
      default: "",
    },
  },
})
</script>

<style lang="scss" scoped>
.data_bar {
  &__title {
    font-size: 1rem;
    font-weight: bold;
    color: $color-subtitle;
    line-height: 1;
    margin-bottom: 0.75rem;
  }
  &__body {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid #293246;
    background: $color-gray-light-transparent;
    box-shadow: 4px 4px 16px 0 $color-moonlight;
    @include sm {
      flex-direction: row;
    }
  }
  ::v-deep(*) {
    .data_bar__item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;

      &__title {
        display: flex;
        align-items: center;
        font-size: 1rem;
        width: 100%;
        height: 1rem;
        line-height: 1;
        font-weight: 700;
        color: $color-title;
      }
      &__subtitle {
        font-size: $text-sm;
        line-height: 1;
        color: $color-light-subtitle;
      }
    }
  }
}
</style>
