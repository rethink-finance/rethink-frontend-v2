<template>
  <div class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector selected="aum" @change="updateChart" />
      </div>
      <!--      <FundChartTimelineSelector selected="3M" @change="updateChart" />-->
    </div>
    <div class="chart__chart_wrapper">
      <ClientOnly>
        <apexchart
          height="400"
          width="100%"
          :options="options"
          :series="series"
        />
      </ClientOnly>
    </div>
  </div>
</template>
<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => ({}),
    },
  },
  data() {
    return {
      chartItems: [] as number[],
      chartDates: [] as Date[],
      chartTimes: [] as string[],
    };
  },
  computed: {
    series() {
      return [{
        name: "NAV",
        data: this.chartItems,
      }];
    },
    options() {
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
          times: this.chartTimes,
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
            right: -26,
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
          labels: {
            style: {
              colors: "var(--color-light-subtitle)",
            },
            offsetX: 0,
            formatter: function(val: number) {
              return abbreviateNumber(val);
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
          categories: this.chartDates,
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
            formatter: function(val: Date) {
              return formatDate(val);
            },
          },
        },
        tooltip: {
          theme: "dark", // You can set the tooltip theme to 'dark' or 'light'
          custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
            return "<div class='custom_tooltip'>" +
              "<div class='tooltip_row'>" +
              "<div class='label'>Date:</div>" + w.globals.categoryLabels[dataPointIndex] + "</div>" +
              "<div class='tooltip_row'>" +
              "<div class='label'>Time:</div>" + w.config.context.times[dataPointIndex] + "</div>" +
              "<div class='tooltip_row'>" +
              "<div class='label'>Price:</div>" + formatUSDValue(series[seriesIndex][dataPointIndex]) + "</div>" +
              "</div>"
          },
        },
      }
    },
  },
  mounted() {
    this.updateChart();
  },
  methods: {
    updateChart(value?: string) {
      // TODO fetch data from API or fetch all together and just change here.
      console.log("updateChart: " + value)
      this.chartItems = this.getRandomData();
      this.chartDates = this.getRandomDates();
      this.chartTimes = this.getRandomTimes();
    },
    getRandomDates() {
      return [
        new Date("2023-01-01"),
        new Date("2023-02-15"),
        new Date("2023-03-30"),
        new Date("2023-04-12"),
        new Date("2023-05-25"),
        new Date("2023-06-08"),
        new Date("2023-07-20"),
        new Date("2023-08-04"),
        new Date("2023-09-17"),
        new Date("2023-10-29"),
      ];
    },
    getRandomTimes() {
      return [
        "09:30:00",
        "10:15:45",
        "12:00:00",
        "14:30:15",
        "15:45:30",
        "17:20:10",
        "19:05:25",
        "21:15:55",
        "22:40:30",
        "23:59:59",
      ]
    },
    getRandomData() {
      // TODO replace with real data and remove this function.
      // generate array of random numbers
      const minNumber = 800000;
      const maxNumber = 2000000;
      return Array.from({ length: 10 }, () =>
        Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber,
      );
    },
  },
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
