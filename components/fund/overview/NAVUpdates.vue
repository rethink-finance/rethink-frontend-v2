<template>
  <div class="details main_card__grid main_card__grid--full-width">
    <UiDataRowCard
      v-for="(navUpdate, index) in fund.nav_updates"
      :key="index"
      :title="navUpdate.date"
      :grow-column1="true"
      :title2="navUpdate.value"
      :grow-column2="true"
    >
      <template #body>
        <div class="details__title">
          **NAV Liquid**
        </div>
        <div class="details__body">
          {{ stringifyDetails(navUpdate.details.nav_liquid) }}
        </div>
        <div class="details__title">
          **NAV Illiquid**
        </div>
        <div class="details__body">
          {{ stringifyDetails(navUpdate.details.nav_illiquid) }}
        </div>
      </template>
      <template #actionText="{ expanded }">
        {{ expanded ? "Close" : "Check" }} Details
      </template>
    </UiDataRowCard>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "NAVUpdates",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  methods: {
    stringifyDetails(detailsJSON: string) {
      return JSON.stringify(JSON.parse(detailsJSON), null, 2)
    },
  },
})
</script>

<style lang="scss" scoped>
.details {
  &__title {
    color: $color-primary;
    font-weight: 700;
  }
  &__body {
    font-family: monospace;
    white-space: pre;
    font-size: $text-sm;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
}
</style>
