<template>
  <div class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="valueShownInTypeSelector"
          :is-loading="areBackendNavUpdatesLoading && selectedType === ChartType.SHARE_PRICE"
          :type-options="ChartTypesMap"
        />
      </div>
      <!--      <FundChartTimelineSelector selected="3M" @change="updateChart" />-->
    </div>
    <div class="chart__chart_wrapper">
      <v-skeleton-loader
        v-if="areBackendNavUpdatesLoading"
        type="ossein"
        height="370px"
        width="100%"
      />
      <!--      <v-skeleton-loader-->
      <!--        v-else-if="areBackendNavUpdatesLoading && selectedType === ChartType.SHARE_PRICE"-->
      <!--        type="ossein"-->
      <!--        height="370px"-->
      <!--        width="100%"-->
      <!--      />-->
      <div v-else class="meta">
        <ClientOnly>
          <apexchart
            v-if="chartPoints.length > 0"
            height="370"
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
import { fetchFundNavUpdatesAction, type ParsedNavUpdateDto } from "~/store/funds/actions/fetchFundNavUpdates.action";
import { formatDate, formatDateLong } from "~/composables/formatters";
import { abbreviateNumber } from "~/composables/abbreviateNumber";

const fundStore = useFundStore();
const blockTimeStore = useBlockTimeStore();
const web3Store = useWeb3Store();
const actionStateStore = useActionStateStore();

const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.NAV);

const sharePriceItemsFromChain = ref([]) as Ref<number[]>;
const areBackendNavUpdatesLoading = ref(true);
const navUpdatesFromBackend = ref<ParsedNavUpdateDto[]>([]);

// Computed
const lastChartPoint = computed(() => chartPoints.value[chartPoints.value.length - 1]);
const valueShownInTypeSelector = computed(() => {
  if (selectedType.value === ChartType.NAV) {
    return fundStore.getFormattedBaseTokenValue(lastChartPoint.value?.valueRaw || 0n);
  }
  if (selectedType.value === ChartType.SHARE_PRICE) {
    return props.fund?.sharePrice?.toString() || lastChartPoint.value?.y.toString() || "0";
  }

  return "N/A";
});

const series = computed(() => [
  {
    name: ChartTypesMap[selectedType.value].value,
    data: chartPoints.value,
  },
]);

const isLoadingFetchFundNAVUpdatesActionState = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});
const fundNavUpdates = computed(() =>
  navUpdatesFromBackend.value.length
    ? navUpdatesFromBackend.value
    : props.fund?.navUpdates ?? [],
)

const sharePriceItems = computed<number[]>(() => {
  if (navUpdatesFromBackend.value.length > 0) {
    return navUpdatesFromBackend.value
      .map(u => u.sharePrice)
  }

  return sharePriceItemsFromChain.value
})

// Check loading state for daily snapshots action
const isLoadingDailySnapshots = computed(() =>
  actionStateStore.isActionState(
    `fetchFundDailySnapshots_${props.fund.chainId}_${props.fund.address}`,
    ActionState.Loading,
  ),
);

// Shared chart points builder to keep logic in one place
type ChartPoint = {
  timestamp: number
  date: string
  x: number
  y: number
  valueRaw: bigint | number
  isSimulated: boolean
  navUpdateIndex: number | null
}

const chartPoints = computed<ChartPoint[]>(() => {
  // Build base points from NAV updates (backend or chain), carrying timestamps
  const basePoints = (fundNavUpdates.value || []).map((navUpdate: INAVUpdate | ParsedNavUpdateDto, idx: number) => ({
    timestamp: navUpdate.timestamp,
    x: navUpdate.timestamp,
    date: navUpdate.date,
    navValue: parseFloat(ethers.formatUnits((navUpdate.totalNAV || 0n) as bigint, props.fund?.baseToken.decimals)),
    valueRaw: (navUpdate.totalNAV || 0n) as bigint,
    sharePriceValue: sharePriceItems.value[idx],  // TODO This is problematic, nothing assures the same number of share prices and nav updates, possible misalignment problem
    navUpdateIndex: navUpdate.index,
    isSimulated: false,
  }));

  // Points from backend daily snapshots (if not loading)
  const snapshotPoints = !isLoadingDailySnapshots.value && props.fund?.backendDailySnapshots?.length
    ? props.fund.backendDailySnapshots.map((s) => ({
      timestamp: Number(s.timestamp),
      x: Number(s.timestamp),
      date: formatDate(new Date(Number(s.timestamp))),
      navValue: s.totalSimulatedNav != null
        ? parseFloat(ethers.formatUnits((s.totalSimulatedNav as bigint), props.fund?.baseToken.decimals))
        : undefined,
      valueRaw: (s.totalSimulatedNav ?? undefined) as bigint | undefined,
      sharePriceValue: s.sharePrice != null ? Number(s.sharePrice) : undefined,
      isSimulated: true,
      navUpdateIndex: null,
    }))
    : [];

  let points: ChartPoint[] = [];

  if (selectedType.value === ChartType.NAV) {
    points = [
      ...basePoints,
      ...snapshotPoints,
    ].filter((p) => p.navValue !== undefined)
      .map((p) => ({ ...p, y: p.navValue, valueRaw: p.valueRaw } as ChartPoint));

    // Add simulated NAV if available
    if (props.fund?.totalSimulatedNav) {
      const ts = props.fund.totalSimulatedNavCalculatedAtISO ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO) : Date.now();
      points.push({
        timestamp: ts,
        date: formatDate(new Date(ts)),
        x: ts,
        y: parseFloat(ethers.formatUnits(props.fund.totalSimulatedNav, props.fund?.baseToken.decimals)),
        valueRaw: props.fund.totalSimulatedNav,
        isSimulated: true,
        navUpdateIndex: null,
      });
    }
  } else {
    // Share price
    points = [
      ...basePoints
        .filter((p) => p.sharePriceValue != null)
        .map((p) => ({ ...p, y: p.sharePriceValue as number, valueRaw: p.sharePriceValue } as ChartPoint)),
      ...snapshotPoints
        .filter((p) => p.sharePriceValue !== undefined)
        .map((p) => ({ ...p, y: p.sharePriceValue as number, valueRaw: p.sharePriceValue } as ChartPoint)),
    ];

    // Add simulated share price if available
    if (props.fund?.sharePrice) {
      const ts = props.fund.totalSimulatedNavCalculatedAtISO ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO) : Date.now();
      points.push({
        timestamp: ts,
        date: formatDate(new Date(ts)),
        x: ts,
        y: props.fund.sharePrice,
        valueRaw: props.fund.sharePrice,
        isSimulated: true,
        navUpdateIndex: null,
      });
    }
  }

  // Sort by timestamp for alignment
  points.sort((a, b) => a.timestamp - b.timestamp);
  console.log("TTT chartPoints ", points);
  return points;
});

const chartPointValues = computed(() => chartPoints.value.map(p => p.y))

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
        right: 8,
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
      // curve: selectedType.value === ChartType.SHARE_PRICE ? "stepline" : "straight",
      curve: "straight",
      lineCap: "round",
      width: 2,
      colors: [ChartTypeStrokeColors[selectedType.value]],
    },
    yaxis: {
      // Set dynamic min and max values with a small buffer (5%) to ensure minor fluctuations
      // in NAV data do not appear overly exaggerated on the chart. This helps in providing a
      // more accurate visual representation when NAV values change slightly between updates.
      min: Math.min(...chartPointValues.value) * 0.95,
      max: Math.max(...chartPointValues.value) * 1.05,
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
      type: "datetime",
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
      custom: function({ seriesIndex, dataPointIndex, w }: { seriesIndex: number, dataPointIndex: number, w: any }) {
        const dataPoint = w.config.series[seriesIndex].data[dataPointIndex]
        console.log(dataPoint);
        let formattedDate = formatDate(new Date(dataPoint.x));

        // Convert BigInt to string to avoid serialization issues
        const valueNav = dataPoint?.valueRaw?.toString() || "0";
        const valueSharePrice = dataPoint?.y || props.fund.sharePrice;

        // Check if this is the simulated NAV data point
        const isSimulatedValue = dataPoint?.isSimulated;
        const isLastValue = dataPointIndex === chartPoints.value?.length - 1;

        const labelTextMap = {
          [ChartType.NAV]: "NAV",
          [ChartType.SHARE_PRICE]: "Share Price",
        }

        let labelText = labelTextMap[selectedType.value];
        if (isSimulatedValue) {
          labelText = "Simulated " + labelText;
        }

        if (isSimulatedValue && isLastValue && props.fund?.totalSimulatedNavCalculatedAtISO) {
          // Use long datetime format with hour and minutes for the simulated value.
          formattedDate = formatDateLong(new Date(props.fund?.totalSimulatedNavCalculatedAtISO));
        }

        return `
          <div class="custom_tooltip">
            <div class="tooltip_row">
              <div class="label">Date:</div> ${formattedDate}
            </div>
            <div class="tooltip_row">
              <div class="label">${labelText}:</div>
              ${selectedType.value === ChartType.NAV ? fundStore.getFormattedBaseTokenValue(valueNav) : abbreviateNumber(valueSharePrice, 3)}
            </div>
          </div>
        `;
      },
    },
  }
});

// Methods
const getSharePricePerNav = async () => {
  areBackendNavUpdatesLoading.value = true;

  // 1. get average block time for the chain
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.fund.chainId, false);
  const averageBlockTime = blockTimeContext?.averageBlockTime || 0;

  sharePriceItemsFromChain.value = await Promise.all(fundNavUpdates.value?.map(async (navUpdate: INAVUpdate | ParsedNavUpdateDto) =>  {
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
      return parseFloat(ethers.formatUnits(sharePriceBigInt, 36));
    }
    catch(e){
      console.error("Error getting share price", e)
      return 0;
    }
  }));
  areBackendNavUpdatesLoading.value = false;
};

const getNavUpdates = () => {
  areBackendNavUpdatesLoading.value = true;

  fetchFundNavUpdatesAction(props.fund.chainId, props.fund.address).then((navUpdates: ParsedNavUpdateDto[]) => {
    navUpdatesFromBackend.value = navUpdates;
    console.warn("TTT fetchFundNavUpdatesAction ", props.fund.chainId, props.fund.address, navUpdates);
    areBackendNavUpdatesLoading.value = false;
  }).catch((error) => {
    console.error(`Failed fetchFundNavUpdatesAction for ${props.fund.address}`, error);
    areBackendNavUpdatesLoading.value = false;
    getSharePricePerNav();
  });
}

// Lifecycle
watch(() => fundStore?.fund?.address, () => {
  // TODO: Could do this and use only this, is much faster, but gets synced only every 5 minutes.
  // watch: fundStore?.fund?.address
  if (!fundStore?.fund?.address) return;
  getNavUpdates();
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
    height: 370px;
    min-height: 370px;
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
