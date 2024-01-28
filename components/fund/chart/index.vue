<template>
  <div class="chart">
    <ClientOnly>
      <apexchart
        height="400"
        width="100%"
        :options="options"
        :series="series"
      />
    </ClientOnly>
  </div>
</template>
<script lang="ts">
export default {
  data() {
    return {
      chartItems: [] as number[],
      chartDates: [] as Date[],
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
        markers: {
          size: 0,
        },
        grid: {
          show: false,
          padding: {
            // This removes the right padding. Without removing it, we have a lot of
            // space on the right of the chart.
            right: -26,
          },
        },
        plotOptions: {
        },
        fill: {
          type: "gradient",
          gradient: {
            shadeIntensity: 1,
            inverseColors: false,
            opacityFrom: 0.25,
            opacityTo: 0.1,
            type: "vertical",
            stops: [3, 100],
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
      }
    },
  },
  mounted() {
    this.chartItems = this.getRandomData();
    this.chartDates = this.getRandomDates();
  },
  methods: {
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
  height: 400px;
  min-height: 400px;
  width: 100%;
  min-width: 100%;
}
</style>
