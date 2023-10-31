<template>
  <v-card
    color="transparent"
    width="70%"
    class="mt-8 justify-center text-center align-items-center"
  >
    <div>
      <h1>{{ route.params.id }}</h1>
      <ClientOnly>
        <!-- @dev: if not loading. review https://github.com/apexcharts/vue3-apexcharts/issues/9 -->
        <!-- @dev: if not loading. review https://github.com/apexcharts/vue3-apexcharts/issues/63 -->
        <!-- @dev: The issue maybe the generateData function is not available during
        hydration of on the client side. moving to computed with get/set and
        moving the generateData function inside of the const series = computed(
        get()) ... may resolve the issue -->

        <apexchart
          v-if="isMounted"
          ref="apexchart"
          type="area"
          width="500"
          height="400"
          :options="chartOptions"
          :series="chartSeries"
        ></apexchart>
      </ClientOnly>
    </div>
  </v-card>
</template>

<script setup>
const isMounted = ref(false);
const apexchart = ref(null);
const route = useRoute();
const chartOptions = ref({
  chart: {
    id: "vuechart-example",
  },
  xaxis: {
    categories: ["24 Jul", "07 Aug", "21 Aug", "04 Sep", "18 Sep", "02 Oct"],
  },
});

const chartSeries = ref({
  name: "Share Price",
  data: [30, 40, 45, 50, 49, 60],
});

onMounted(() => {
  if (process.client) {
    isMounted.value = true;
    if (apexchart.value) apexchart.value.updateOptions(chartOptions);
  }
});
</script>
