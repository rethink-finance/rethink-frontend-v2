<template>
  <div class="details main_card__grid main_card__grid--full-width">
    <UiDataRowCard
      v-for="(navUpdate, index) in fund.nav_updates"
      :key="index"
      :title="navUpdate.date"
      :grow-column1="true"
      :title2="navUpdate.value"
      :grow-column2="true"
      title3="Show Details"
    >
      <template #body>
        <div class="details__body">
          {{ stringifyDetails(navUpdate.details) }}
        </div>
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
  &__body {
    font-family: monospace;
    white-space: pre;
  }
}
</style>
