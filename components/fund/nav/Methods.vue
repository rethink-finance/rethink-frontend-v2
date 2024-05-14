<template>
  <div class="details main_grid main_grid--full-width main_grid--no-gap">
    <FundNavMethodsTable :methods="fund.navMethods" />
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
  data: () => ({
    expanded: [],
    headers: [
      { title: "#", key: "index", sortable: false },
      { title: "Position Name", key: "positionName", sortable: false },
      { title: "Valuation Source", key: "valuationSource", sortable: false },
      { title: "Position Type", key: "positionType", sortable: false },
      { key: "details", sortable: false },
    ],
  }),
  methods: {
    formatNAV(value: bigint) {
      return formatTokenValue(value, this.fund.baseToken.decimals) + " " + this.fund.baseToken.symbol;
    },
  },
})
</script>

<style lang="scss" scoped>
.details {
  &__body {
    font-family: monospace;
    white-space: pre;
    font-size: $text-sm;
    padding: 1rem 7.1rem;
    background-color: $color-badge-navy;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
  &__json{
    @include borderGray;
    background-color: $color-card-background;
    padding: 1.5rem;
    color: $color-primary;
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }
  &__button {
    @include borderGray;
    padding: 0.5rem 1rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    font-size: $text-xs;
    font-weight: 500;
    color: $color-text-irrelevant;

    &--text_expanded{
      font-weight: 700;
      color: $color-white;
    }
    &__expanded{
      background-color: $color-background-button;
    }
  }
  &__button_icon {
    margin-left: 0.5rem;
  }
}
</style>
