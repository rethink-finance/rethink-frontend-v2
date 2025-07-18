<template>
  <div v-if="!isLoadingFetchFundNAVUpdatesActionState" class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="valueShownInTypeSelector"
          :is-loading="isSharePriceLoading && selectedType === ChartType.SHARE_PRICE"
          :type-options="ChartTypesMap"
        />
      </div>
      <!--      <FundChartTimelineSelector selected="3M" @change="updateChart" />-->
    </div>
    <div class="chart__chart_wrapper">
      <v-skeleton-loader
        v-if="isSharePriceLoading && selectedType === ChartType.SHARE_PRICE"
        type="ossein"
        height="400px"
        width="100%"
      />
      <div v-else class="meta">
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
  </div>
</template>
<script lang="ts" setup>
import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";
import { ChartType, ChartTypesMap, ChartTypeStrokeColors } from "~/types/enums/chart_type";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";

const fundStore = useFundStore();
const blockTimeStore = useBlockTimeStore();
const web3Store = useWeb3Store();
const actionStateStore = useActionStateStore();

const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.NAV);

const sharePriceItems = ref([]) as Ref<number[]>;
const isSharePriceLoading = ref(true);

// Computed
const valueShownInTypeSelector = computed(() => {
  const items: Record<ChartType, string> = {
    [ChartType.NAV]: fundStore.fundTotalNAVFormattedShort,
    [ChartType.SHARE_PRICE]: sharePriceItems.value[sharePriceItems.value.length - 1]?.toString() || "0",
  }

  return items[selectedType.value];
});

const series = computed(() => [
  {
    name: ChartTypesMap[selectedType.value].value,
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
  const items: Record<ChartType, number[]> = {
    [ChartType.NAV]: props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => parseFloat(
      ethers.formatUnits(navUpdate.totalNAV || 0n, props.fund?.baseToken.decimals),
    )) || [],
    [ChartType.SHARE_PRICE]: sharePriceItems.value,
  };

  return items[selectedType.value];
})

const chartDates = computed(() => {
  const items: Record<ChartType, string[]> = {
    [ChartType.NAV]: props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => navUpdate.date) || [],
    [ChartType.SHARE_PRICE]: props.fund?.navUpdates?.map((navUpdate: INAVUpdate) => navUpdate.date) || [],
  };

  return items[selectedType.value];
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
      strokeColors: ChartTypeStrokeColors[selectedType.value],
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
      colors: [ChartTypeStrokeColors[selectedType.value]],
    },
    stroke: {
      show: true,
      curve: selectedType.value === ChartType.SHARE_PRICE ? "stepline" : "straight",
      lineCap: "round",
      width: 2,
      colors: [ChartTypeStrokeColors[selectedType.value]],
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
      custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
        const valueNav = totalNAVItems.value[dataPointIndex];
        const valueSharePrice = sharePriceItems.value[dataPointIndex];

        return `
          <div class='custom_tooltip'>
            <div class='tooltip_row'>
              <div class='label'>Date:</div> ${w.globals.categoryLabels[dataPointIndex]}
            </div>
            <div class='tooltip_row'>
              <div class='label'>${selectedType.value === ChartType.NAV ? "NAV" : "Share Price"}:</div>
              ${selectedType.value === ChartType.NAV ? formatWei(valueNav) : valueSharePrice}
            </div>
          </div>
        `;
      },
    },
  }
});

// Methods
const formatWei = (value: bigint) => {
  return formatTokenValue(value, props.fund?.baseToken.decimals) + " " + props.fund?.baseToken.symbol;
};

const getSharePricePerNav = async () => {
  isSharePriceLoading.value = true;

  // 1. get average block time for the chain
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.fund.chainId, false);
  const averageBlockTime = blockTimeContext?.averageBlockTime || 0;

  sharePriceItems.value = await Promise.all(props.fund?.navUpdates?.map(async (navUpdate: INAVUpdate) =>  {
    // 2. get block number for the timestamp
    const totalNav = ethers.parseUnits(String(navUpdate.totalNAV || "0"), props.fund?.baseToken.decimals);
    const blockNumber = Number(await blockTimeStore.getBlockByTimestamp(props.fund.chainId, navUpdate.timestamp / 1000, averageBlockTime) || 0);

    try {
      const totalSupplyRaw = await web3Store.callWithRetry(
        props.fund.chainId,
        () => {
          const fundTokenContract = web3Store.getCustomContract(
            props.fund.chainId,
            ERC20,
            props.fund.fundToken.address,
          );

          return fundTokenContract.methods.totalSupply().call({}, blockNumber);
        },
      );

      const totalSupply = ethers.parseUnits(String(totalSupplyRaw || "0"), props.fund.fundToken.decimals);

      // Determine the highest decimals between NAV and Supply
      const navDecimals = props.fund.baseToken.decimals;
      const supplyDecimals = props.fund.fundToken.decimals;
      const diffDecimals = navDecimals - supplyDecimals;

      // Scale totalNav to the same decimals as totalSupply for proper division
      const adjustedTotalNav = diffDecimals < 0 ? totalNav * 10n ** BigInt(-diffDecimals) : totalNav;
      const adjustedTotalSupply = diffDecimals > 0 ? totalSupply * 10n ** BigInt(diffDecimals) : totalSupply;

      // Perform the division
      const scaleFactor = 10n ** 36n; // Scale up before division to avoid rounding errors
      const sharePriceBigInt = totalSupply > 0n ? (adjustedTotalNav * scaleFactor) / adjustedTotalSupply : 0n;

      // Convert to float and format the share price correctly
      const sharePrice = parseFloat(ethers.formatUnits(sharePriceBigInt, 36));

      return sharePrice;
    }
    catch(e){
      console.error("Error getting share price", e)
      return 0;
    }
  }));
  isSharePriceLoading.value = false;
};


// Lifecycle

watch(() => selectedType.value, () => {
  if (selectedType.value === ChartType.SHARE_PRICE && props.fund && !sharePriceItems.value?.length) {
    getSharePricePerNav();
  }
}, { immediate: true });
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
