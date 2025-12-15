<template>
  <div class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="valueShownInTypeSelector"
          :is-loading="
            areBackendNavUpdatesLoading &&
              selectedType === ChartType.SHARE_PRICE
          "
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
          <div
            v-else
            class="w-100 d-flex justify-center align-center h-100 my-4"
          >
            <h3 v-if="selectedType == ChartType.NAV">
              NAV data is currently not available.
            </h3>
            <h3 v-else-if="selectedType == ChartType.SHARE_PRICE">
              Share price data is currently not available.
            </h3>
            <h3 v-else>
              Data is currently not available.
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
import {
  ChartType,
  ChartTypesMap,
  ChartTypeStrokeColors,
} from "~/types/enums/chart_type";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import {
  fetchFundNavUpdatesAction,
  type ParsedNavUpdateDto,
} from "~/store/funds/actions/fetchFundNavUpdates.action";
import { formatDate, formatDateLong } from "~/composables/formatters";
import { abbreviateNumber } from "~/composables/abbreviateNumber";
import { useSettingsStore } from "~/store/settings/settings.store";

const fundStore = useFundStore();
const blockTimeStore = useBlockTimeStore();
const web3Store = useWeb3Store();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.SHARE_PRICE);

const sharePriceItemsFromChain = ref([]) as Ref<number[]>;
const areBackendNavUpdatesLoading = ref(true);
const navUpdatesFromBackend = ref<ParsedNavUpdateDto[]>([]);

// Computed
const lastChartPoint = computed(
  () => chartPoints.value[chartPoints.value.length - 1],
);
const valueShownInTypeSelector = computed(() => {
  if (selectedType.value === ChartType.NAV) {
    return fundStore.getFormattedBaseTokenValue(
      lastChartPoint.value?.valueRaw || 0n,
    );
  }
  if (selectedType.value === ChartType.SHARE_PRICE) {
    return abbreviateNumber(
      props.fund?.sharePrice || lastChartPoint.value?.y || 0,
      3,
    );
  }

  return "N/A";
});

const series = computed(() => [
  {
    name: ChartTypesMap[selectedType.value].value,
    data: chartPoints.value,
  },
]);

const fundNavUpdates = computed<INAVUpdate[] | ParsedNavUpdateDto[]>(() =>
  // INAVUpdate comes from the chain, and ParseNavUpdateDto is from the backend.
  navUpdatesFromBackend.value.length
    ? navUpdatesFromBackend.value
    : (props.fund?.navUpdates ?? []),
);

const sharePriceItems = computed<number[]>(() => {
  if (navUpdatesFromBackend.value.length > 0) {
    return navUpdatesFromBackend.value.map((u) => u.sharePrice);
  }

  return sharePriceItemsFromChain.value;
});

// Check loading state for daily snapshots action
const isLoadingDailySnapshots = computed(() =>
  actionStateStore.isActionState(
    `fetchFundDailyNavSnapshots_${props.fund.chainId}_${props.fund.address}`,
    ActionState.Loading,
  ),
);

// Shared chart points builder to keep logic in one place
type ChartPoint = {
  timestamp: number;
  date: string;
  x: number;
  y: number;
  valueRaw?: bigint;
  isSimulated: boolean;
  navUpdateIndex: number | null;
};

// NAV-only chart points
const navChartPoints = computed<ChartPoint[]>(() => {
  const baseTokenDecimals = props.fund?.baseToken?.decimals;
  if (!baseTokenDecimals) {
    return [];
  }
  // NAV updates.
  // INAVUpdate comes from the chain, and ParseNavUpdateDto is from the backend.
  const navUpdates = (fundNavUpdates.value || []).map(
    (navUpdate: INAVUpdate | ParsedNavUpdateDto) => {
      const ts = navUpdate.timestamp;
      const navBig = (navUpdate.totalNAV || 0n) as bigint;
      return {
        timestamp: ts,
        date: navUpdate.date,
        x: ts,
        y: parseFloat(ethers.formatUnits(navBig, baseTokenDecimals)),
        valueRaw: navBig,
        isSimulated: false,
        navUpdateIndex: navUpdate.index,
      } as ChartPoint;
    },
  );

  // Daily NAV snapshots fetched from the backend.
  const dailyNavSnapshots: ChartPoint[] =
    !isLoadingDailySnapshots.value &&
    props.fund?.backendDailyNavSnapshots?.length
      ? props.fund.backendDailyNavSnapshots
        .filter((s) => s.totalSimulatedNav != null)
        .map((s) => {
          const ts = Number(s.timestamp);
          const navBig = s.totalSimulatedNav as bigint;
          return {
            timestamp: ts,
            date: formatDate(new Date(ts)),
            x: ts,
            y: parseFloat(ethers.formatUnits(navBig, baseTokenDecimals)),
            valueRaw: navBig,
            isSimulated: true,
            navUpdateIndex: null,
          } as ChartPoint;
        })
      : [];

  const points: ChartPoint[] = [...navUpdates, ...dailyNavSnapshots];

  // Add simulated NAV if available
  if (props.fund?.totalSimulatedNav) {
    const ts = props.fund.totalSimulatedNavCalculatedAtISO
      ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO)
      : Date.now();
    points.push({
      timestamp: ts,
      date: formatDate(new Date(ts)),
      x: ts,
      y: parseFloat(
        ethers.formatUnits(props.fund.totalSimulatedNav, baseTokenDecimals),
      ),
      valueRaw: props.fund.totalSimulatedNav,
      isSimulated: true,
      navUpdateIndex: null,
    });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
});

// Share-price-only chart points
const sharePriceChartPoints = computed<ChartPoint[]>(() => {
  // Base points from NAV updates timestamps and sharePrice items aligned by index
  const base: ChartPoint[] = (fundNavUpdates.value || [])
    .map((navUpdate: INAVUpdate | ParsedNavUpdateDto, idx: number) => {
      const price = sharePriceItems.value[idx];
      if (price == null) return null;
      const ts = navUpdate.timestamp;
      return {
        timestamp: ts,
        date: navUpdate.date,
        x: ts,
        y: price as number,
        isSimulated: false,
        navUpdateIndex: navUpdate.index,
      } as ChartPoint;
    })
    .filter(Boolean) as ChartPoint[];

  // Daily snapshots
  const snapshots: ChartPoint[] =
    !isLoadingDailySnapshots.value &&
    props.fund?.backendDailyNavSnapshots?.length
      ? props.fund.backendDailyNavSnapshots
        .filter((s) => s.sharePrice != null)
        .map((s) => {
          const ts = Number(s.timestamp);
          const price = Number(s.sharePrice);
          return {
            timestamp: ts,
            date: formatDate(new Date(ts)),
            x: ts,
            y: price,
            isSimulated: true,
            navUpdateIndex: null,
          } as ChartPoint;
        })
      : [];

  const points: ChartPoint[] = [...base, ...snapshots];

  // Add the current simulated share price if available
  if (props.fund?.sharePrice) {
    const ts = props.fund.totalSimulatedNavCalculatedAtISO
      ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO)
      : Date.now();
    points.push({
      timestamp: ts,
      date: formatDate(new Date(ts)),
      x: ts,
      y: props.fund.sharePrice,
      isSimulated: true,
      navUpdateIndex: null,
    });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
});

// Selector depending on the chosen type
const chartPoints = computed<ChartPoint[]>(() =>
  selectedType.value === ChartType.NAV
    ? navChartPoints.value
    : sharePriceChartPoints.value,
);

const chartPointValues = computed(() => chartPoints.value.map((p) => p.y));

// Indices of points that correspond to real NAV updates (have navUpdateIndex)
const navUpdateMarkerIndexes = computed<number[]>(() =>
  appSettingsStore.isManageMode
    ? chartPoints.value
      .map((p, idx) => (p.navUpdateIndex != null ? idx : -1))
      .filter((idx) => idx >= 0)
    : [],
);

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
      // Show markers only on points that have navUpdateIndex
      discrete: navUpdateMarkerIndexes.value.map((dataPointIndex) => ({
        seriesIndex: 0,
        dataPointIndex,
        size: 2,
        fillColor: "#3e5283",
        strokeColor: ChartTypeStrokeColors[selectedType.value],
        shape: "circle",
      })),
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
      min: chartPointValues.value.length
        ? Math.min(...chartPointValues.value) * 0.95
        : undefined,
      max: chartPointValues.value.length
        ? Math.max(...chartPointValues.value) * 1.05
        : undefined,
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
      custom: function ({
        seriesIndex,
        dataPointIndex,
        w,
      }: {
        seriesIndex: number;
        dataPointIndex: number;
        w: any;
      }) {
        const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
        let formattedDate = formatDate(new Date(dataPoint.x));
        const navUpdateIndex = dataPoint.navUpdateIndex;
        // Convert BigInt to string to avoid serialization issues
        const valueNav = dataPoint?.valueRaw?.toString() || "0";
        const valueSharePrice = Number(
          dataPoint?.y ?? props.fund.sharePrice ?? 0,
        );

        // Check if this is the simulated NAV data point
        const isSimulatedValue = dataPoint?.isSimulated;
        const isLastValue = dataPointIndex === chartPoints.value?.length - 1;

        const labelTextMap = {
          [ChartType.NAV]: "NAV",
          [ChartType.SHARE_PRICE]: "Share Price",
        };

        const labelText = labelTextMap[selectedType.value];
        // if (isSimulatedValue) {
        //   labelText = "Simulated " + labelText;
        // }

        if (
          isSimulatedValue &&
          isLastValue &&
          props.fund?.totalSimulatedNavCalculatedAtISO
        ) {
          // Use long datetime format with hour and minutes for the simulated value.
          formattedDate = formatDateLong(
            new Date(props.fund?.totalSimulatedNavCalculatedAtISO),
          );
        }

        const navRow =
          navUpdateIndex != null && appSettingsStore.isManageMode
            ? `
      <div class="tooltip_row">
        <div class="label">NAV Update:</div>
        #${navUpdateIndex}
      </div>
    `
            : "";

        return `
          <div class="custom_tooltip">
            <div class="tooltip_row">
              <div class="label">${labelText}:</div>
              ${selectedType.value === ChartType.NAV ? fundStore.getFormattedBaseTokenValue(valueNav) : abbreviateNumber(valueSharePrice, 3)}
            </div>
            ${navRow}
            <div class="tooltip_row">
              ${formattedDate}
            </div>
          </div>
        `;
      },
    },
  };
});

// Methods
const getSharePricePerNav = async () => {
  areBackendNavUpdatesLoading.value = true;

  // 1. get average block time for the chain
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(
    props.fund.chainId,
    false,
  );
  const averageBlockTime = blockTimeContext?.averageBlockTime || 0;

  sharePriceItemsFromChain.value = await Promise.all(
    fundNavUpdates.value?.map(
      async (navUpdate: INAVUpdate | ParsedNavUpdateDto) => {
        // 2. get block number for the timestamp
        const totalNav = ethers.parseUnits(
          String(navUpdate.totalNAV || "0"),
          props.fund?.baseToken.decimals,
        );
        const blockNumber = Number(
          (await blockTimeStore.getBlockByTimestamp(
            props.fund.chainId,
            navUpdate.timestamp / 1000,
            averageBlockTime,
          )) || 0,
        );

        try {
          const totalSupplyRaw = await web3Store.callWithRetry(
            props.fund.chainId,
            () => {
              const fundTokenContract = web3Store.getCustomContract(
                props.fund.chainId,
                ERC20,
                props.fund.fundToken.address,
              );

              return fundTokenContract.methods
                .totalSupply()
                .call({}, blockNumber);
            },
          );

          const totalSupply = ethers.parseUnits(
            String(totalSupplyRaw || "0"),
            props.fund.fundToken.decimals,
          );

          // Determine the highest decimals between NAV and Supply
          const navDecimals = props.fund.baseToken.decimals;
          const supplyDecimals = props.fund.fundToken.decimals;
          const diffDecimals = navDecimals - supplyDecimals;

          // Scale totalNav to the same decimals as totalSupply for proper division
          const adjustedTotalNav =
            diffDecimals < 0
              ? totalNav * 10n ** BigInt(-diffDecimals)
              : totalNav;
          const adjustedTotalSupply =
            diffDecimals > 0
              ? totalSupply * 10n ** BigInt(diffDecimals)
              : totalSupply;

          // Perform the division
          const scaleFactor = 10n ** 36n; // Scale up before division to avoid rounding errors
          const sharePriceBigInt =
            totalSupply > 0n
              ? (adjustedTotalNav * scaleFactor) / adjustedTotalSupply
              : 0n;

          // Convert to float and format the share price correctly
          return parseFloat(ethers.formatUnits(sharePriceBigInt, 36));
        } catch (e) {
          console.error("Error getting share price", e);
          return 0;
        }
      },
    ),
  );
  areBackendNavUpdatesLoading.value = false;
};

const getNavUpdates = () => {
  areBackendNavUpdatesLoading.value = true;

  fetchFundNavUpdatesAction(props.fund.chainId, props.fund.address)
    .then((navUpdates: ParsedNavUpdateDto[]) => {
      navUpdatesFromBackend.value = navUpdates;
      console.warn(
        "TTT fetchFundNavUpdatesAction ",
        props.fund.chainId,
        props.fund.address,
        navUpdates,
      );
      areBackendNavUpdatesLoading.value = false;
    })
    .catch((error) => {
      console.error(
        `Failed fetchFundNavUpdatesAction for ${props.fund.address}`,
        error,
      );
      areBackendNavUpdatesLoading.value = false;
      getSharePricePerNav();
    });
};

// Lifecycle
watch(
  () => fundStore?.fund?.address,
  () => {
    // TODO: Could do this and use only this, is much faster, but gets synced only every 5 minutes.
    // watch: fundStore?.fund?.address
    if (!fundStore?.fund?.address) return;
    getNavUpdates();
  },
  { immediate: true },
);
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
    @include borderGray("border", true, #aec5ff);
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
