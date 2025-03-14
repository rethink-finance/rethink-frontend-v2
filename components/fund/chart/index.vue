<template>
  <div v-if="!isLoadingFetchFundNAVUpdatesActionState" class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="fundStore.fundTotalNAVFormattedShort"
          :type-options="ChartTypesMap"
        />
      </div>
      <!--      <FundChartTimelineSelector selected="3M" @change="updateChart" />-->
    </div>
    <div class="chart__chart_wrapper">
      <ClientOnly>
        <apexchart
          v-if="chartItems.length > 0"
          height="400"
          width="100%"
          :options="options"
          :series="series"
        />
        <div v-else class="w-100 d-flex justify-center align-center h-100">
          <h3>
            No NAV updates available yet.
          </h3>
        </div>
      </ClientOnly>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ethers } from "ethers";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import { ChartType, ChartTypesMap } from "~/types/enums/chart_type";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";


const fundStore = useFundStore();
const actionStateStore = useActionStateStore();


const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.NAV);

// Computeds
const series = computed(() => [
  {
    name: "NAV",
    data: chartItems.value,
  },
  {
    name: "Share Price",
    data: chartItems.value,
  },
]);

const isLoadingFetchFundNAVUpdatesActionState = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});

const totalNAVItems = computed(() => {
  return props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => navUpdate.totalNAV || 0n) || [];
});

const chartItems = computed(() => {
  return props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => parseFloat(
    ethers.formatUnits(navUpdate.totalNAV || 0n, props.fund?.baseToken.decimals),
  )) || [];
});

const chartDates = computed(() => {
  return props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => navUpdate.date) || [];
});

const options = computed(() => {
  return {
    chart: {
      id: "nav-area-chart",
      type: "area",
      background: "var(--color-gray-light-transparent)",
      stacked: false,
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    context: {
      // Store additional context data here.
      navUpdates: props.fund?.navUpdates || [],
    },
    markers: {
      size: 0,
      colors: ["transparent"],
      strokeColors: "var(--color-primary)",
      strokeWidth: 2,
    },
    grid: {
      show: false,
      padding: {
        // This removes the right padding. Without removing it, we have a lot of
        // space on the right of the chart.
        // TODO if you use here -26 it extends the chart until the end of the div, but the last label
        //   is not entirely visible.
        right: 0,
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.25,
        opacityTo: 0.1,
        type: "vertical",
        stops: [20, 100],
      },
      colors: ["var(--color-primary)"],
    },
    stroke: {
      show: true,
      curve: "straight",
      lineCap: "round",
      width: 2,
      colors: ["var(--color-primary)"],
    },
    yaxis: {
      // Set dynamic min and max values with a small buffer (5%) to ensure minor fluctuations
      // in NAV data do not appear overly exaggerated on the chart. This helps in providing a
      // more accurate visual representation when NAV values change slightly between updates.
      min: Math.min(...chartItems.value) * 0.95,
      max: Math.max(...chartItems.value) * 1.05,
      forceNiceScale: true,
      labels: {
        style: {
          colors: "var(--color-light-subtitle)",
        },
        offsetX: 0,
        formatter: (value: number) => {
          return abbreviateNumber(value, 3);
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    xaxis: {
      categories: chartDates.value,
      tickAmount: 4,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      crosshairs: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
      labels: {
        style: {
          colors: "var(--color-light-subtitle)",
        },
      },
    },
    tooltip: {
      theme: "dark", // You can set the tooltip theme to 'dark' or 'light'
      // TODO when multiple series use:
      // custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
      custom: ({ dataPointIndex, w }: any) => {
        return "<div class='custom_tooltip'>" +
          "<div class='tooltip_row'>" +
          "<div class='label'>Date:</div>" + w.globals.categoryLabels[dataPointIndex] + "</div>" +
          "<div class='tooltip_row'>" +
          "<div class='label'>NAV:</div>" + formatWei(totalNAVItems.value[dataPointIndex]) + "</div>" +
          "</div>"
      },
    },
  }
});

// Methods
const formatWei = (value: bigint) => {
  return formatTokenValue(value, props.fund?.baseToken.decimals) + " " + props.fund?.baseToken.symbol;
};
</script>




<style lang="scss" scoped>
.chart {
  width: 100%;
  min-width: 100%;

  &__toolbar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  &__chart_wrapper {
    height: 400px;
    min-height: 400px;
  }
  ::v-deep(.custom_tooltip) {
    display: flex;
    padding: 0.75rem;
    flex-direction: column;
    justify-content: center;
    opacity: 1;
    gap: 0.5rem;
    line-height: 1;
    background: #242e45;
    font-size: $text-sm;
    font-weight: 500;
    @include borderGray("border", true, #AEC5FF);
    border-width: 2px;
    //box-shadow: 4px 46px 16px 0 rgba(31, 95, 255, 0.16);

    .tooltip_row {
      display: flex;
      flex-direction: row;
    }
    .label {
      padding-right: 0.5rem;
    }
  }
}
</style>
