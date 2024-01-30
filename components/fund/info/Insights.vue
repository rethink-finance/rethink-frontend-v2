<template>
  <div class="fund_insights">
    <div class="fund_insights__item">
      <div class="fund_insights__item__title">
        <Icon
          v-if="fund?.chain"
          :name="chainIconName"
          size="0.75rem"
          class="mr-2"
          color="white"
        />
        {{ capitalizeFirst(fund.chain) }}
      </div>
      <div class="fund_insights__item__subtitle">
        Chain
      </div>
    </div>
    <div class="fund_insights__item">
      <div class="fund_insights__item__title">
        {{ fund.inception_date }}
      </div>
      <div class="fund_insights__item__subtitle">
        Inception Date
      </div>
    </div>
    <div class="fund_insights__item">
      <div
        class="fund_insights__item__title"
        :class="valueSignClass(fund.cumulative_return_percent)"
      >
        {{ formatPercent(fund.cumulative_return_percent) }}
      </div>
      <div class="fund_insights__item__subtitle">
        Cumulative Return
      </div>
    </div>
    <div class="fund_insights__item">
      <div
        class="fund_insights__item__title"
        :class="valueSignClass(fund.monthly_return_percent)"
      >
        {{ formatPercent(fund.monthly_return_percent) }}
      </div>
      <div class="fund_insights__item__subtitle">
        Monthly Return
      </div>
    </div>
    <div class="fund_insights__item">
      <div class="fund_insights__item__title">
        {{ fund.sharpe_ratio }}
      </div>
      <div class="fund_insights__item__subtitle">
        Sharpe Ratio
      </div>
    </div>
    <div class="fund_insights__item">
      <div class="fund_insights__item__title">
        <FundInfoPositionTypesBar
          :position-types="fund.position_types"
        />
      </div>
      <div class="fund_insights__item__subtitle">
        Position Types
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  name: "FundInsights",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {};
  },
  computed: {
    chainIconName() {
      return `cryptocurrency-color:${chainToIconName(this.fund?.chain)}`;
    },
  },
  methods: {
    valueSignClass(value: number) {
      if (value > 0) {
        return "text-success";
      } else if (value < 0) {
        return "text-error";
      }
      return "";
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_insights {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid #293246;
  background: $color-gray-light-transparent;
  box-shadow: 4px 4px 16px 0 $color-moonlight;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;

    &__title {
      display: flex;
      font-size: 1rem;
      width: 100%;
      height: 1rem;
      line-height: 1;
      font-weight: 700;
      color: $color-title;
    }
    &__subtitle {
      font-size: $text-md-sm;
      line-height: 1;
      color: $color-light-subtitle;
    }
  }
}
</style>
