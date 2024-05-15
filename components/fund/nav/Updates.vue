<template>
  <div class="details main_grid main_grid--full-width">
    <template v-if="fund.navUpdates?.length > 0">

      <!-- TODO fix title when NAV update timestamps become available -->
      <UiDataRowCard
        v-for="(navUpdate, index) in fund.navUpdates"
        :key="index"
        :title="'#' + (Number(navUpdate.date) + 1)"
        :grow-column1="true"
        :title2="formatNAV(navUpdate.totalNAV)"
        :grow-column2="true"
        no-body-padding
        bg-transparent
      >
        <template #body>
          <FundNavMethodsTable :methods="navUpdate.entries" />
        </template>
        <template #actions="{detailsExpanded}">
          <div class="details__button" :class="{'details__button--expanded': detailsExpanded}">
            <span :class="detailsExpanded ? 'details__button--text-expanded' : ''">
              Details
            </span>
            <v-icon
              class="details__button_icon"
              :color="detailsExpanded ? 'primary' : ''"
              :icon="detailsExpanded ? 'mdi-menu-up' : 'mdi-menu-down'"
            />
          </div>
        </template>
      </UiDataRowCard>
    </template>

    <template v-else>
      There are currently no NAV updates.
    </template>
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
