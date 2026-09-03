<template>
  <div class="chart brand_card">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="valueShownInTypeSelector"
          :is-loading="
            areBackendNavUpdatesLoading &&
              !chartPoints.length &&
              selectedType === ChartType.SHARE_PRICE
          "
          :type-options="ChartTypesMap"
        />
      </div>
      <UiRangePills
        :model-value="effectiveRange"
        :ranges="rangeKeys"
        :available="drawableRanges"
        @update:model-value="selectedRange = $event"
      />
    </div>
    <div class="chart__chart_wrapper">
      <!-- Skeleton only while there is nothing to draw: a page served from cache
           has last visit's points, and the refresh redraws over them. -->
      <v-skeleton-loader
        v-if="areBackendNavUpdatesLoading && !chartPoints.length"
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
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
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
import {
  shouldPriceFromNav,
  type SharePriceObservation,
} from "~/composables/monthlyReturns";
import { abbreviateNumber } from "~/composables/abbreviateNumber";
import { calculateSharePrice } from "~/composables/exchangeRate";
import { useSettingsStore } from "~/store/settings/settings.store";
import { resolveStakingRewards } from "~/store/funds/config/stakingRewards.config";

const fundStore = useFundStore();
const blockTimeStore = useBlockTimeStore();
const web3Store = useWeb3Store();
const appSettingsStore = useSettingsStore();

const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.SHARE_PRICE);

const sharePriceItemsFromChain = ref([]) as Ref<number[]>;
// Last visit's updates arrive with the fund when the page is served from
// cache, so the chart draws on the first frame and the fetch redraws it.
const navUpdatesFromBackend = ref<ParsedNavUpdateDto[]>(
  props.fund?.backendNavUpdates ?? [],
);
const areBackendNavUpdatesLoading = ref(!navUpdatesFromBackend.value.length);

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
    // A share price is a price *in* something — carry the base asset with it,
    // the same way the NAV figure above does.
    const price = abbreviateNumber(
      props.fund?.sharePrice || lastChartPoint.value?.y || 0,
      3,
    );
    return `${price} ${props.fund?.baseToken?.symbol ?? ""}`.trim();
  }

  return "N/A";
});

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

/** The yield overlay is green so it reads as gain against the cyan base series. */
const YIELD_STROKE_COLOR = "#38de8e";

/**
 * Set only for vaults whose yield is paid out somewhere else — see
 * stakingRewards.config.ts. Undefined for everything else, which leaves this
 * chart exactly as it was.
 */
const stakingRewards = computed(() =>
  resolveStakingRewards(props.fund?.chainId, props.fund?.address),
);

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * The line the vault would be drawing if it kept its staking rewards instead of
 * distributing them.
 *
 * Both lines are anchored at the left edge of the range on view, so the window
 * asks and answers one question: what has this position done since the start of
 * it. A yield line carrying rewards accrued before the window would part company
 * with the share price at the very first pixel, which reads as a data fault
 * rather than as history the window does not cover.
 *
 * The consequence is that this gap is the gain over the visible range, not the
 * vault's lifetime figure — the header owns that one, and it is measured from
 * inception, which is earlier than any price the feed holds. The legend names
 * the window's gain so the two are never read as the same claim.
 *
 * Accrual is linear rather than compounded on purpose: these rewards are paid
 * out in another token, so they never get restaked into this position — the
 * same arithmetic resolveStakingPerformance uses for the headline figures.
 */
const yieldChartPoints = computed<ChartPoint[]>(() => {
  const netYieldPercent = stakingRewards.value?.netYieldPercent;
  if (!netYieldPercent) return [];

  const points = chartPoints.value;
  if (points.length < 2) return [];

  const startTimestamp = points[0].timestamp;

  return points.map((point) => ({
    ...point,
    y:
      point.y *
      (1 +
        (netYieldPercent / 100) *
          ((point.timestamp - startTimestamp) / YEAR_MS)),
    valueRaw: undefined,
  }));
});

/** Rewards accrued across the range on view, in percent. */
const yieldRangeGainPercent = computed(() => {
  const netYieldPercent = stakingRewards.value?.netYieldPercent;
  const points = chartPoints.value;
  if (!netYieldPercent || points.length < 2) return 0;

  const span = points[points.length - 1].timestamp - points[0].timestamp;
  return (netYieldPercent * span) / YEAR_MS;
});

/**
 * Names the window's gain, not just the rate. Without it the line's rise
 * invites comparison with the cumulative return above the chart, which counts
 * from inception and so is the larger number — two true figures that look like
 * a contradiction until each says which period it covers.
 */
const yieldSeriesName = computed(() =>
  stakingRewards.value
    ? `${stakingRewards.value.rewardTokenSymbol} rewards · +${yieldRangeGainPercent.value.toFixed(2)}% · ${stakingRewards.value.netYieldPercent.toFixed(2)}% APR`
    : "",
);

const series = computed(() => {
  const chartSeries = [
    {
      name: ChartTypesMap[selectedType.value].value,
      data: chartPoints.value,
    },
  ];

  if (yieldChartPoints.value.length) {
    chartSeries.push({
      name: yieldSeriesName.value,
      data: yieldChartPoints.value,
    });
  }

  return chartSeries;
});

const hasYieldSeries = computed(() => yieldChartPoints.value.length > 0);

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

/**
 * The share price line for a vault that never minted shares, drawn from its
 * NAV instead.
 *
 * Dividing by a supply of zero leaves such a vault reporting a share price of
 * nought for its whole history, so the series plots flat on the axis floor and
 * then leaps to whatever today's simulated price is — a cliff that says nothing
 * about the vault. Holding the share count fixed makes the share price a
 * constant multiple of NAV, and the one price we do have fixes that multiple.
 *
 * Returns nothing unless there is a price and a value to pin it to.
 */
/**
 * Whether this vault's NAV describes its share price better than its own price
 * feed does — the same test the monthly returns table and the portfolio apply,
 * so the three never disagree about what a vault has done.
 */
const priceFromNav = computed(() =>
  shouldPriceFromNav([
    // The chain's INAVUpdate and the backend's DTO differ in shape; only the
    // fields below are read, and a missing one reads as absent either way.
    ...(fundNavUpdates.value ?? []).map(
      (update): SharePriceObservation => ({
        timestamp: update.timestamp,
        sharePrice: (update as ParsedNavUpdateDto).sharePrice,
        totalNav: (update as ParsedNavUpdateDto).totalNAV,
        totalSupply: (update as ParsedNavUpdateDto).totalSupply,
      }),
    ),
    ...(props.fund?.backendDailyNavSnapshots ?? []).map((snapshot) => ({
      timestamp: snapshot.timestamp,
      sharePrice: snapshot.sharePrice,
      totalNav: snapshot.totalSimulatedNav,
      totalSupply: snapshot.totalSupply,
    })),
  ]),
);

const constantSupplySharePricePoints = computed<ChartPoint[]>(() => {
  const decimals = props.fund?.baseToken?.decimals;
  const knownPrice = props.fund?.sharePrice;
  const knownNav = props.fund?.totalSimulatedNav;
  if (!knownPrice || !knownNav || decimals == null) return [];

  const navAtKnownPrice = parseFloat(ethers.formatUnits(knownNav, decimals));
  if (!navAtKnownPrice) return [];

  const pricePerNav = knownPrice / navAtKnownPrice;
  const scaled = navChartPoints.value.map((point) => ({
    ...point,
    y: point.y * pricePerNav,
    // The raw value belongs to NAV, and the tooltip reads share price here.
    valueRaw: undefined,
  }));

  // The substitution assumes the share count never moved, but the feeds only
  // record a supply from some point on — before that the assumption is
  // unchecked. soonami Venture Staking is why this matters: a 992 WETH deposit
  // landed in that blind spot, and scaling straight through it drew a share
  // price of 0.52 for a vault whose price has never left 1.00 — dilution
  // dressed up as a crash. So the unsupervised prefix is only trusted where
  // its NAV sits near the NAV at the first supply reading; anything further
  // out may be a different share count, and no line is better than that one.
  const supplyKnownTimestamps = new Set<number>();
  for (const update of fundNavUpdates.value ?? []) {
    if ((update as ParsedNavUpdateDto).totalSupply != null) {
      supplyKnownTimestamps.add(update.timestamp);
    }
  }
  for (const snapshot of props.fund?.backendDailyNavSnapshots ?? []) {
    if (snapshot.totalSupply != null) {
      supplyKnownTimestamps.add(snapshot.timestamp);
    }
  }

  const anchorIndex = scaled.findIndex((point) =>
    supplyKnownTimestamps.has(point.timestamp),
  );
  if (anchorIndex <= 0) return scaled;

  const anchor = scaled[anchorIndex].y;
  if (!anchor) return scaled;
  return scaled.filter(
    (point, index) =>
      index >= anchorIndex || Math.abs(point.y / anchor - 1) <= 0.05,
  );
});

/**
 * When the vault first settled, or undefined if it never has.
 *
 * Before a vault records a NAV update it has no settled price to issue shares
 * at, so deposits mint at par no matter what the simulated price reads — the
 * same rule the monthly returns table gates on. That makes every simulated
 * price before the first settlement a number nobody could have transacted at.
 * CarrotFunding is why this is worth filtering rather than explaining: it
 * carried ~4.97 USDC of NAV for three days with no shares in issue at all, so
 * the first 2.7 shares to exist inherited the lot and priced at 2.21, and the
 * 37,095 USDC that followed minted at 1.00 and dropped it back. The chart drew
 * a 55% collapse for a vault that had only ever taken money in. Its own
 * contract settles the argument: the 0.1 share redeemed in that window paid out
 * 0.0998 USDC, at par, while the chart was claiming 2.21.
 */
const firstSettlementTimestamp = computed<number | undefined>(() => {
  const timestamps = (fundNavUpdates.value ?? [])
    .map((navUpdate: INAVUpdate | ParsedNavUpdateDto) => Number(navUpdate.timestamp))
    .filter((ts) => Number.isFinite(ts) && ts > 0);

  return timestamps.length ? Math.min(...timestamps) : undefined;
});

// Share-price-only chart points
const sharePriceChartPoints = computed<ChartPoint[]>(() => {
  // Base points from NAV updates timestamps and sharePrice items aligned by index
  const base: ChartPoint[] = (fundNavUpdates.value || [])
    .map((navUpdate: INAVUpdate | ParsedNavUpdateDto, idx: number) => {
      const price = sharePriceItems.value[idx];
      // A share price of nought is a reading the vault could not take, not a
      // vault worth nothing. Plotting it draws a floor and then a cliff.
      if (price == null || price <= 0) return null;
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
    props.fund?.backendDailyNavSnapshots?.length
      ? props.fund.backendDailyNavSnapshots
        .filter((s) => s.sharePrice != null && Number(s.sharePrice) > 0)
        // Nothing the vault could have transacted at — see
        // firstSettlementTimestamp. A vault that has never settled keeps its
        // snapshots, since dropping them leaves no chart to explain itself with.
        .filter(
          (s) =>
            firstSettlementTimestamp.value == null ||
            Number(s.timestamp) >= firstSettlementTimestamp.value,
        )
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

  // One price is a dot, not a line: a vault priced only once has never really
  // been priced. Nor is a handful of recent prices a history, where the vault's
  // share count never moved and its NAV covers the days the price feed missed —
  // see shouldPriceFromNav in composables/monthlyReturns.
  if (points.length < 2 || priceFromNav.value) {
    const fromNav = constantSupplySharePricePoints.value;
    if (fromNav.length) return fromNav;
  }

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
const allChartPoints = computed<ChartPoint[]>(() =>
  selectedType.value === ChartType.NAV
    ? navChartPoints.value
    : sharePriceChartPoints.value,
);

/**
 * Recent history first: what a vault has done this month is the question people
 * arrive with, and it is the window that shows movement instead of flattening
 * it against a year of scale. A vault with too little history to fill it falls
 * back to everything it has — see resolveEffectiveRange in chartRanges.
 */
const rangeKeys = RANGE_KEYS;
const selectedRange = ref("1M");

const drawableRanges = computed(() => availableRanges(allChartPoints.value));

const effectiveRange = computed(() =>
  resolveEffectiveRange(selectedRange.value, drawableRanges.value),
);

const chartPoints = computed<ChartPoint[]>(
  () =>
    pointsInRange(allChartPoints.value, effectiveRange.value) ??
    allChartPoints.value,
);

// The y-axis has to frame both lines, or the yield overlay runs off the top.
const chartPointValues = computed(() => [
  ...chartPoints.value.map((p) => p.y),
  ...yieldChartPoints.value.map((p) => p.y),
]);

/** Intervals to aim for between gridlines, and how much room the data gets. */
const Y_AXIS_INTERVALS = 5;
/** The spread is given 1/2 the plot before the bounds round outwards. */
const Y_AXIS_HEADROOM = 2;

/**
 * The smallest 1/2/2.5/5 × 10ⁿ at or above a rough step, so gridlines land on
 * figures a reader can hold in their head — and, more to the point, on figures
 * that stay distinct once rounded for display.
 */
const niceStep = (rough: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const scaled = rough / magnitude;
  const factor =
    scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return factor * magnitude;
};

/** Rounds away the float noise that floor/ceil on a fractional step leaves. */
const tidy = (value: number) => Number(value.toFixed(12));

/**
 * Axis bounds framed around the data's own spread, so real movement fills the
 * plot instead of hugging a line. Padding proportional to the absolute value
 * (the old ±5%) let the denomination set the scale: a share price near 1.0 got
 * a tenth of an axis all to itself, and a 4% year read as a flat line.
 *
 * Bounds are then rounded out to whole steps and the tick count is fixed to
 * match, which is what keeps the labels honest. Left to derive its own ticks
 * from arbitrary bounds, Apex handed two neighbouring gridlines the same
 * rounded value and silently blanked one of them — a gap in the axis that
 * reads as a rendering fault.
 *
 * The `decimals` that come back are the fewest that write the step exactly:
 * two for a share price stepping by 0.01, four for one stepping by 0.0001. The
 * axis is never more precise than its own gridlines.
 *
 * The floor on the span stops a genuinely flat series being stretched until its
 * noise reads as drama — flat vaults are allowed to look flat; they are not
 * allowed to make everything else look flat. The lower clamp keeps a
 * wide-ranging series from implying the vault was ever worth less than nothing.
 */
const yAxisBounds = computed(() => {
  const blank = {
    min: undefined,
    max: undefined,
    tickAmount: undefined,
    decimals: 2,
  };

  const values = chartPointValues.value;
  if (!values.length) return blank;

  const low = Math.min(...values);
  const high = Math.max(...values);
  const mid = (low + high) / 2;
  const span = Math.max((high - low) * Y_AXIS_HEADROOM, Math.abs(mid) * 0.02);
  if (!span || !Number.isFinite(span)) return blank;

  // Never finer than 1% of the figure being plotted. An axis with more
  // resolution than that is measuring noise, and it drags the labels along
  // with it: a share price sitting at 1.00 was drawing gridlines 0.005 apart
  // and needing three decimals to tell them apart. This is what holds a
  // near-1.00 price to two decimals while leaving a 0.0036 one the four it
  // genuinely needs.
  const step = niceStep(
    Math.max(span / Y_AXIS_INTERVALS, Math.abs(mid) * 0.01),
  );
  const max = tidy(Math.ceil((mid + span / 2) / step) * step);
  let min = tidy(Math.floor((mid - span / 2) / step) * step);
  if (low >= 0) min = Math.max(min, 0);

  let decimals = 0;
  while (decimals < 8 && Math.abs((step * 10 ** decimals) % 1) > 1e-9) {
    decimals++;
  }

  return {
    min,
    max,
    tickAmount: Math.max(1, Math.round((max - min) / step)),
    decimals,
  };
});

// Indices of points that correspond to real NAV updates (have navUpdateIndex)
const navUpdateMarkerIndexes = computed<number[]>(() =>
  appSettingsStore.isManageMode
    ? chartPoints.value
      .map((p, idx) => (p.navUpdateIndex != null ? idx : -1))
      .filter((idx) => idx >= 0)
    : [],
);

const options = computed(() => {
  // Apex paints these as SVG attributes, where var(--…) never resolves, so
  // the two chrome colors that differ per theme are picked here. Reading the
  // store's theme also makes this computed rebuild on a switch. Series
  // strokes stay the raw brand hues in both themes by design.
  const isLightTheme = appSettingsStore.theme === "light";
  const markerFillColor = isLightTheme ? "#ffffff" : "#1d212d";
  const gridLineColor = isLightTheme
    ? "rgba(10, 14, 26, 0.07)"
    : "rgba(255, 255, 255, 0.05)";
  return {
    chart: {
      id: "nav-area-chart",
      type: "area",
      // The chart now sits inside a card of its own, so the plot area no
      // longer needs a fill to separate itself from the page.
      background: "transparent",
      // The yield overlay arrives after the first paint, and the options object
      // is rebuilt again as the backend NAV updates land. Apex handles that by
      // restarting its draw-in animation, and with two series it ends up
      // stranding both of them flat on the axis floor. Nothing animates, so
      // nothing can be left half-drawn.
      animations: {
        enabled: !hasYieldSeries.value,
      },
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
        fillColor: markerFillColor,
        strokeColor: ChartTypeStrokeColors[selectedType.value],
        shape: "circle",
      })),
    },
    grid: {
      // Design reads the series against faint horizontal rules instead of a
      // tinted plot area — verticals stay off so the line keeps the emphasis.
      show: true,
      borderColor: gridLineColor,
      strokeDashArray: 0,
      xaxis: {
        lines: { show: false },
      },
      yaxis: {
        lines: { show: true },
      },
      padding: {
        // This removes the right padding. Without removing it, we have a lot of
        // space on the right of the chart.
        right: 8,
      },
    },
    fill: {
      // The yield overlay is a reference line, not a second area — it gets a
      // solid fill at zero opacity so only its stroke shows.
      type: hasYieldSeries.value ? ["gradient", "solid"] : "gradient",
      opacity: hasYieldSeries.value ? [1, 0] : 1,
      gradient: {
        // Apex shades the fade-out end of the gradient itself, toward black
        // by default — on the light theme that muddies the area into a grey
        // wash, so light shades toward white and thins the fill (a wash
        // blooms on white in a way it never does on the dark ground).
        shade: isLightTheme ? "light" : "dark",
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: isLightTheme ? 0.16 : 0.25,
        opacityTo: isLightTheme ? 0.02 : 0.1,
        type: "vertical",
        stops: [20, 100],
      },
      colors: [ChartTypeStrokeColors[selectedType.value], YIELD_STROKE_COLOR],
    },
    stroke: {
      show: true,
      // curve: selectedType.value === ChartType.SHARE_PRICE ? "stepline" : "straight",
      curve: "straight",
      lineCap: "round",
      width: 2,
      // Dashed, because it is what the position earns rather than what the
      // vault has recorded.
      dashArray: hasYieldSeries.value ? [0, 5] : 0,
      colors: [ChartTypeStrokeColors[selectedType.value], YIELD_STROKE_COLOR],
    },
    legend: {
      show: hasYieldSeries.value,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "var(--font-mono)",
      fontSize: "11.5px",
      offsetY: -4,
      labels: {
        colors: "var(--color-light-subtitle)",
      },
      markers: {
        // strokeWidth must be 0. ApexCharts builds the legend dot from the
        // series marker config, so it inherits markers.strokeColors above —
        // which is the base series' blue. Left at its default of 1 that rings
        // the green yield dot in blue.
        //
        // size is the v5 spelling; width/height/radius were the v3 options and
        // are silently ignored, which is how the dot ended up at its default 16px.
        size: 5,
        strokeWidth: 0,
        offsetX: -3,
      },
      itemMargin: {
        horizontal: 10,
      },
    },
    yaxis: {
      min: yAxisBounds.value.min,
      max: yAxisBounds.value.max,
      // The bounds are already whole steps apart, so Apex is told exactly how
      // many gridlines to draw rather than inventing its own from them.
      tickAmount: yAxisBounds.value.tickAmount,
      forceNiceScale: false,
      labels: {
        style: {
          colors: "var(--color-light-subtitle)",
        },
        offsetX: 0,
        // Abbreviated above a thousand, where the K/M suffix is the readable
        // form; below it, written to the precision of the step and no further.
        formatter: (value: number) =>
          Math.abs(value) >= 1000
            ? abbreviateNumber(value, 3)
            : value.toFixed(yAxisBounds.value.decimals),
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
        dataPointIndex,
        w,
      }: {
        seriesIndex: number;
        dataPointIndex: number;
        w: any;
      }) {
        // Always read series 0. With the yield overlay on, the tooltip is
        // shared, so the hovered seriesIndex says which line the cursor is
        // nearest — not which one the reader came for.
        const dataPoint = w.config.series[0].data[dataPointIndex];
        const yieldPoint = w.config.series[1]?.data[dataPointIndex];
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
          [ChartType.SHARE_PRICE]: "Share price",
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
        <div class="label">NAV update</div>
        <div class="value">#${navUpdateIndex}</div>
      </div>
    `
            : "";

        const baseSymbol = props.fund?.baseToken?.symbol ?? "";

        const yieldRow = yieldPoint
          ? `
      <div class="tooltip_row">
        <div class="label">With ${stakingRewards.value?.rewardTokenSymbol}</div>
        <div class="value" style="color: ${YIELD_STROKE_COLOR}">${abbreviateNumber(Number(yieldPoint.y ?? 0), 3)} ${baseSymbol}</div>
      </div>
    `
          : "";

        // Both formatters end in " SYMBOL"; splitting it off lets the unit sit
        // quieter than the figure, the way the stat row above the chart does.
        const valueText =
          selectedType.value === ChartType.NAV
            ? fundStore.getFormattedBaseTokenValue(valueNav)
            : `${abbreviateNumber(valueSharePrice, 3)} ${baseSymbol}`;
        const unitSuffix = ` ${baseSymbol}`;
        const hasUnit = Boolean(baseSymbol) && valueText.endsWith(unitSuffix);
        const amountText = hasUnit
          ? valueText.slice(0, -unitSuffix.length)
          : valueText;

        const metaRows = yieldRow + navRow;

        return `
          <div class="custom_tooltip">
            <div class="custom_tooltip__date">${formattedDate}</div>
            <div class="custom_tooltip__headline">
              <span class="custom_tooltip__amount">${amountText}</span>
              ${hasUnit ? `<span class="custom_tooltip__unit">${baseSymbol}</span>` : ""}
            </div>
            <div class="custom_tooltip__caption">${labelText}</div>
            ${metaRows ? `<div class="custom_tooltip__meta">${metaRows}</div>` : ""}
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

          return calculateSharePrice(totalNav, totalSupply);
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
  // The skeleton only while there is nothing to draw; a redraw is silent.
  areBackendNavUpdatesLoading.value = !navUpdatesFromBackend.value.length;

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
    // A different vault starts from its own cached updates, or from none.
    navUpdatesFromBackend.value = props.fund?.backendNavUpdates ?? [];
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
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.125rem;
  }

  &__chart_wrapper {
    height: 370px;
    min-height: 370px;
  }

  /* With markers.size 0, Apex still emits one degenerate marker path
     ("M 0, 0 … a 0,0 …") per series, and its round stroke linecap paints a
     2px dot at the plot's top-left corner — invisible on the dark ground,
     a stray blue speck next to the axis labels on white. A zero-geometry
     path carries no data, so hiding the shape loses nothing. */
  ::v-deep(.apexcharts-svg path[d^="M 0, 0"]) {
    display: none;
  }
  /* Apex draws its own panel around whatever the custom renderer returns;
     blanking it stops a second border showing through the one below. */
  ::v-deep(.apexcharts-tooltip.apexcharts-theme-dark) {
    background: transparent;
    border: none;
    box-shadow: none;
    overflow: visible;
  }

  /**
   * A reading off the line: when, how much, of what. The figure leads because
   * it is what the cursor was moved to find; the date sets it in time above,
   * and anything else is a footnote below a rule.
   */
  ::v-deep(.custom_tooltip) {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.6875rem 0.875rem;
    background: $color-navy-gray-light;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    box-shadow: var(--shadow-float);
    line-height: 1;

    .custom_tooltip__date {
      font-family: $font-mono;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }

    .custom_tooltip__headline {
      display: flex;
      align-items: baseline;
      gap: 0.3125rem;
      font-family: $font-mono;
      white-space: nowrap;
    }

    .custom_tooltip__amount {
      font-size: 16px;
      font-weight: 500;
      color: $color-white;
    }

    .custom_tooltip__unit {
      font-size: 11.5px;
      color: $color-steel-blue;
    }

    .custom_tooltip__caption {
      font-size: 11px;
      color: $color-text-irrelevant;
    }

    .custom_tooltip__meta {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-top: 0.4375rem;
      padding-top: 0.4375rem;
      border-top: 1px solid $color-line;
    }

    .tooltip_row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1.25rem;
      font-family: $font-mono;
      font-size: 11px;
      white-space: nowrap;
    }

    .label {
      color: $color-steel-blue;
    }

    .value {
      color: $color-white;
    }
  }
}
</style>
