<template>
  <div class="chart_type">
    <UiSegmented
      v-if="hasMultipleTypeOptions"
      :model-value="selected"
      :options="segmentedOptions"
      @update:model-value="emit('update:selected', $event)"
    />
    <div v-else class="chart_type__eyebrow">
      {{ selectedTypeValue }}
    </div>

    <div class="chart_type__headline">
      <v-progress-circular
        v-if="isLoading"
        class="d-flex"
        size="22"
        width="2"
        indeterminate
      />
      <template v-else>
        <span class="chart_type__value">{{ value }}</span>
        <span class="chart_type__note">{{ selectedTypeValue }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChartTypesMap, type ChartType, type IChartType } from "~/types/enums/chart_type";


const props = defineProps<{
  value: string;
  selected: ChartType;
  typeOptions: Record<ChartType, IChartType>;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "update:selected", value: string): void;
}>();

const selectedTypeValue = computed(() => ChartTypesMap[props.selected].value);
const hasMultipleTypeOptions = computed(() => Object.keys(props.typeOptions).length > 1);

const segmentedOptions = computed(() =>
  Object.values(props.typeOptions).map((option: IChartType) => ({
    key: option.key,
    label: option.value,
  })),
);
</script>

<style lang="scss" scoped>
/**
 * The design surfaces the chart series as a segmented control with the current
 * figure spelled out underneath, rather than the dropdown this used to be —
 * with only two series there is nothing worth hiding behind a menu.
 */
.chart_type {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__eyebrow {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__headline {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  &__value {
    font-family: $font-mono;
    font-size: 30px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__note {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }
}
</style>
