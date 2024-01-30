<template>
  <div class="data_row card_box">
    <div class="data_row__title">
      {{ title }}
    </div>
    <div class="data_row__subtitle">
      {{ subtitle }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
  name: "DataRowCard",
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
})
</script>

<style lang="scss" scoped>
.data_row {
  background: $color-navy-gray-light;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  line-height: 1;
  overflow: hidden;

  &__title {
    font-weight: 700;
    color: $color-title;
  }
  &__subtitle {
    font-weight: 500;
    color: $color-subtitle;
    font-size: $text-sm;
  }
  &__title, &__subtitle {
    @include ellipsis;
    max-width: 100%;
  }
}
</style>
