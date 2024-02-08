<template>
  <div class="data_bar">
    <div v-if="title" class="data_bar__title">
      {{ title }}
    </div>
    <div class="data_bar__body">
      <slot />
    </div>
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
    display: flex;
  }
  &__body {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas: "left center right";
    gap: 1.5rem;

    @include lg {
      align-items: center;
      display: flex;
      justify-content: space-between;
      border: 1px solid $color-border-dark;
      background: $color-gray-light-transparent;
      padding: 1rem;
      box-shadow: 4px 4px 16px 0 $color-moonlight;
      flex-direction: row;
    }
  }
  ::v-deep(*) {
    .data_bar__item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      // Mobile there are 3 columns, align:
      // 1st column: left
      // 2nd column: center
      // 3rd column: right
      &:nth-of-type(3n) {
        align-items: flex-end;
        .data_bar__subtitle,
        .data_bar__title {
          justify-content: end;
          text-align: end;
        }
      }
      &:nth-of-type(3n-1) {
        align-items: center;
        .data_bar__subtitle,
        .data_bar__title {
          justify-content: center;
          text-align: center;
        }
      }
      &:nth-of-type(3n-2) {
        align-items: flex-start;
      }
      @include lg {
        &:nth-of-type(n){
          align-items: flex-start;
          .data_bar__subtitle,
          .data_bar__title {
            justify-content: flex-start;
            text-align: start;
          }
        }
      }
    }
    .data_bar__title {
      display: flex;
      width: 100%;
      align-items: center;
      font-size: 1rem;
      height: 1rem;
      line-height: 1;
      font-weight: 700;
      color: $color-title;
      @include lg {
        width: 100%;
      }
    }
    .data_bar__subtitle {
      font-size: $text-sm;
      line-height: 1;
      color: $color-light-subtitle;
    }
  }
}
</style>
