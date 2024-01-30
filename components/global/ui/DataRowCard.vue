<template>
  <div class="data_row card_box">
    <span>


      <div class="data_row__title">
        {{ title }}
      </div>
      <div class="data_row__subtitle">
        {{ subtitle }}
      </div>
    </span>
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
  padding: 0.75rem 1rem;
  line-height: 1;

  &__title {
    font-weight: 700;
    color: $color-title;
  }
  &__subtitle {
    font-weight: 500;
    color: $color-subtitle;
    font-size: $text-sm;
  }
}
</style>
