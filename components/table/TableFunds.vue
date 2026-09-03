<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_all_funds"
    :headers="headers"
    hover
    :items="items"
    :item-value="rowKey"
    :sort-by="[{ key: 'totalSimulatedNavUSD', order: 'desc' }]"
    :loading="loading && items.length === 0"
    loading-text="Loading OIVs"
    items-per-page="-1"
    @mousedown:row="navigateFundDetails"
  >
    <template #[`item.name`]="{ item }">
      <FundNameCell
        :image="item.photoUrl"
        :title="item.title"
        :subtitle="getItemSubtitle(item)"
      />
    </template>

    <template #[`item.curator`]="{ item }">
      <div v-if="item.strategistName" class="curator-cell">
        {{ item.strategistName }}
      </div>
      <div v-else>
        -
      </div>
    </template>

    <template #[`item.chainShort`]="{ item }">
      <div class="chain-cell">
        <IconChain :chain-short="item.chainShort" />
      </div>
    </template>

    <template #[`item.baseAsset`]="{ item }">
      <div class="base-asset-cell">
        <BaseAssetIcon
          :chain-id="item.chainId"
          :chain-short="item.chainShort"
          :token-address="item.baseToken.address"
          :symbol="item.baseToken.symbol"
          class="mr-2"
        />
        <span class="base-asset-cell__symbol">{{ item.baseToken.symbol }}</span>
      </div>
    </template>

    <template #[`item.totalSimulatedNavUSD`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template
          v-else-if="!item.totalSimulatedNav && !item.lastNAVUpdateTotalNAV"
        >
          N/A
        </template>
        <template v-else>
          <v-tooltip
            v-if="item.totalSimulatedNav && item.totalSimulatedNavCalculatedAt"
            :disabled="!appSettingsStore.isManageMode"
            location="bottom"
            content-class="brand_tooltip"
          >
            <template #activator="{ props }">
              <div class="d-flex flex-column align-end nav_cell" v-bind="props">
                <div class="nav_cell__value">
                  {{
                    formatNumberShort(
                      formatTokenValue(
                        item.totalSimulatedNav || item.lastNAVUpdateTotalNAV,
                        item.baseToken.decimals,
                        false,
                        false,
                      ),
                    ) +
                      " " +
                      item.baseToken.symbol
                  }}
                </div>
                <div v-if="navUsd(item)" class="nav_usd_value">
                  ${{ formatNumberShort(navUsd(item)) }}
                </div>
              </div>
            </template>
            <div class="brand_tooltip__label">
              Calculated on
            </div>
            <div class="brand_tooltip__value">
              {{ item.totalSimulatedNavCalculatedAt }}
            </div>
          </v-tooltip>
          <v-tooltip
            v-else
            location="bottom"
            :disabled="!appSettingsStore.isManageMode"
            content-class="brand_tooltip"
          >
            <template #activator="{ props }">
              <div class="d-flex flex-column align-end nav_cell" v-bind="props">
                <div>
                  {{
                    formatNumberShort(
                      formatTokenValue(
                        item.totalSimulatedNav || item.lastNAVUpdateTotalNAV,
                        item.baseToken.decimals,
                      ),
                    ) +
                      " " +
                      item.baseToken.symbol
                  }}
                </div>
                <div v-if="navUsd(item)" class="nav_usd_value">
                  ${{ formatNumberShort(navUsd(item)) }}
                </div>
              </div>
            </template>
            <div class="brand_tooltip__value">
              <template v-if="item?.navUpdates?.length > 0">
                Based on the last NAV update
              </template>
              <template v-else>
                Based on the current NAV methods
              </template>
            </div>
          </v-tooltip>
        </template>
      </div>
    </template>

    <!-- 30D share price trend -->
    <template #[`item.sparkline`]="{ item }">
      <div class="sparkline-cell">
        <SparklineCell
          :chain-id="item.chainId"
          :address="item.address"
          @performance="thirtyDayPerformance[rowKey(item)] = $event"
        />
      </div>
    </template>

    <!-- cumulative -->
    <template #[`item.cumulativeReturnPercent`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <div
          v-else
          :class="numberColorClass(roundPercent(getCumulativeReturn(item)))"
        >
          {{ formatReturn(getCumulativeReturn(item)) }}
        </div>
      </div>
    </template>

    <!-- apr -->
    <template #[`item.apr`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          <div :class="numberColorClass(roundPercent(getApr(item)))">
            {{
              getApr(item) === undefined ? "--" : formatReturn(getApr(item))
            }}
          </div>
        </template>
      </div>
    </template>

    <!--    <template #[`item.positionTypeCounts`]="{ item }">-->
    <!--      <PositionTypesBar-->
    <!--        :position-type-counts="item.positionTypeCounts ?? []"-->
    <!--        class="position_types_bar"-->
    <!--      />-->
    <!--    </template>-->

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>

  <div v-else-if="items.length === 0 && !loading" class="nav_entries__no_data">
    No OIVs available.
  </div>
</template>

<script lang="ts" setup>
import BaseAssetIcon from "../global/icon/BaseAsset.vue";
import FundNameCell from "./components/FundNameCell.vue";
import SparklineCell from "./components/SparklineCell.vue";
import {
  formatNumberShort,
  formatPercent,
  formatTokenValue,
} from "~/composables/formatters";
import { calculateAPR } from "~/composables/utils";
import { usdPerBaseToken } from "~/composables/portfolioPositions";
import { numberColorClass } from "~/composables/numberColorClass.js";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import type IFund from "~/types/fund";
import { useSettingsStore } from "~/store/settings/settings.store";
import { fundMetaDataHardcoded } from "~/store/funds/config/fundMetadata.config";
import { resolveStakingPerformance } from "~/store/funds/config/stakingRewards.config";
import { ChainId } from "~/types/enums/chain_id";

const { getFundDetailsUrl } = usePageNavigation();
const router = useRouter();
const appSettingsStore = useSettingsStore();

defineProps({
  items: {
    type: Array as () => IFund[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

/**
 * Rows are keyed by vault rather than by position. The store replaces a
 * chain's fund objects whenever its data refreshes, and a keyed row keeps
 * its DOM and its sparkline through that swap, and through a re-sort.
 */
const rowKey = (fund: IFund): string => `${fund.chainId}:${fund.address}`;

/**
 * 30D change per vault, published by each row's sparkline once it has its
 * series. Kept beside the rows rather than on them: a figure stored on a
 * fund object is lost when the store swaps that object for a fresh one.
 */
const thirtyDayPerformance = reactive<Record<string, number>>({});

/**
 * Round to the precision the cell prints: two decimals of a *percentage*, so
 * four of the underlying fraction. Rounding here rather than leaving it to
 * formatPercent keeps a figure that displays as 0% from being coloured as a
 * gain or a loss.
 */
const roundPercent = (value?: number): number =>
  parseFloat((value ?? 0).toFixed(4));

/**
 * A return, at the precision its size deserves.
 *
 * Under 1000% this is what it always was. Past it the two decimals are false
 * precision on a figure that is an extrapolation anyway — a young vault's APR
 * annualises a few weeks of return and lands in the thousands — and they are
 * also what used to widen the APR column enough to put a scrollbar under the
 * whole table.
 */
const formatReturn = (value?: number): string => {
  const rounded = roundPercent(value);
  const percent = rounded * 100;
  if (Math.abs(percent) < 1000) return formatPercent(rounded, true);
  const text = percent.toFixed(0) + "%";
  return percent > 0 ? "+" + text : text;
};

/**
 * The vault's NAV in dollars.
 *
 * Prefers the backend's own quote. Where there is none, usdPerBaseToken values a
 * stablecoin-denominated vault at par rather than at nothing, so a USDC vault
 * gets a dollar figure instead of a blank line — the answer is the number
 * already printed above it, and omitting it reads as missing data.
 *
 * Returns undefined for a vault whose base asset cannot be priced at all;
 * a wrong number is worse there than none.
 */
const navUsd = (fund: IFund): number | undefined => {
  if (fund.totalSimulatedNavUSD) return Number(fund.totalSimulatedNavUSD);

  const nav = fund.totalSimulatedNav ?? fund.lastNAVUpdateTotalNAV;
  const decimals = fund.baseToken?.decimals;
  if (nav == null || decimals == null) return undefined;

  const rate = usdPerBaseToken(fund);
  if (!rate) return undefined;

  return (Number(nav) / 10 ** decimals) * rate;
};

/**
 * A vault that pays its yield out in another token has a share price that never
 * moves, so its measured return and APR are 0% forever. Where we know what the
 * underlying position earns, both columns come from that instead — the same
 * figures its own page shows.
 */
const getStakingPerformance = (fund: IFund) =>
  resolveStakingPerformance(
    fund.chainId,
    fund.address,
    fund.inceptionDateTimestamp,
  );

const getCumulativeReturn = (fund: IFund): number | undefined =>
  getStakingPerformance(fund)?.cumulativeReturn ?? fund.cumulativeReturnPercent;

const getApr = (fund: IFund): number | undefined =>
  getStakingPerformance(fund)?.apr ??
  calculateAPR(fund.cumulativeReturnPercent, fund.inceptionDateTimestamp);

const headers: any = computed(() => [
  {
    title: "Vault Name",
    key: "name",
    sortable: false,
    align: "start",
    // No width: the name column absorbs the space the fixed data columns
    // leave, so the table stretches to the card instead of overflowing it.
  },
  {
    title: "Current NAV",
    key: "totalSimulatedNavUSD",
    align: "end",
    width: 130,
  },
  {
    title: "Curator",
    key: "curator",
    value: (v: IFund) => v.strategistName || "",
    sortable: true,
    align: "start",
    width: 180,
  },
  {
    title: "Base Asset",
    key: "baseAsset",
    value: (v: IFund) => v.baseToken?.symbol || "",
    sortable: true,
    width: 125,
    align: "center",
  },
  {
    title: "Chain",
    key: "chainShort",
    width: 80,
    align: "center",
  },
  // {
  //   title: "Latest NAV Date",
  //   key: "lastNavUpdateTime",
  //   value: (v: IFund) => v.lastNavUpdateTime,
  //   align: "end",
  // },
  // {
  //   title: "Inception",
  //   key: "inceptionDate",
  //   value: (v: IFund) => v.inceptionDate,
  //   align: "end",
  // },
  {
    title: "30D",
    key: "sparkline",
    value: (v: IFund) => thirtyDayPerformance[rowKey(v)] ?? -Infinity,
    align: "center",
    width: 130,
    sortable: true,
  },
  {
    title: "Cum. Return",
    key: "cumulativeReturnPercent",
    // Sort on what the column actually shows, so the staking vault does not
    // sort as 0% while displaying its yield-derived return.
    value: (v: IFund) => getCumulativeReturn(v) ?? -Infinity,
    align: "end",
    width: 120,
  },
  {
    title: "APR",
    key: "apr",
    // Wide enough for a three-digit percentage. At the old 80 the cell had
    // 48px of content space, which "+512.34%" overflows — and being the last
    // column, what it overflows into is the table's own scroll area, so a
    // single high-APR vault put a scrollbar under every row. The 30px comes
    // out of the name column, which is the one that absorbs.
    width: 110,
    // Same treatment as Cum. Return: sort on the figure the cell prints, so a
    // staking vault sorts on its yield-derived APR rather than on a missing
    // field, and a vault with no APR at all sinks instead of sorting as 0%.
    value: (v: IFund) => getApr(v) ?? -Infinity,
    align: "end",
  },
  // {
  //   title: "Monthly",
  //   key: "monthlyReturnPercent",
  //   maxWidth: 100,
  //   value: (v: IFund) => formatPercent(v.monthlyReturnPercent, true),
  //   align: "end",
  // },

  // TODO: show sharpe ratio later
  // {
  //   title: "Sharpe Ratio",
  //   key: "sharpeRatio",
  //   maxWidth: 100,
  //   value: (v: IFund) => v.sharpeRatio || "N/A",
  //   align: "end",
  // },
  // {
  //   title: "Position Types",
  //   key: "positionTypeCounts",
  //   align: "end",
  // },
]);

const getItemSubtitle = (fund: IFund) => {
  // Get subtitle from fundMetadata if available, otherwise use the provided subtitle
  if (fund.address && fund.chainId) {
    // Find the fund in the metadata by address
    const chainFunds = fundMetaDataHardcoded[fund.chainId as ChainId] || [];
    const fundMetadata = chainFunds.find(
      (fundMetadata) =>
        fundMetadata.address.toLowerCase() === fund.address.toLowerCase(),
    );

    // If found and has a subtitle, use it
    if (fundMetadata?.subtitle) {
      return fundMetadata.subtitle;
    }
  }

  // Fallback to the provided subtitle
  return fund.description;
};

const navigateFundDetails = (event: any, row: any) => {
  // Check if the click target is an anchor (<a>) or any clickable element
  const target = event.target as HTMLElement;

  if (target.tagName.toLowerCase() === "a" || target.closest("a")) {
    // If the target is an anchor tag, prevent the row navigation
    return;
  }

  const fundDetailsUrl = getFundDetailsUrl(
    row.item.chainId,
    row.item.fundToken.symbol,
    row.item.address,
  );

  // Check if the middle mouse button or a modifier key (e.g., Ctrl/Command) is pressed
  if (event.button === 1 || event.metaKey || event.ctrlKey) {
    // Allow the default behavior (open in a new tab)
    window.open(fundDetailsUrl, "_blank");
  } else {
    // Normal left-click behavior (navigate)
    router.push(fundDetailsUrl);
  }
};
</script>

<style lang="scss" scoped>
/* Design-file table: card surface with hairline borders, quiet rows
   that raise to surface-2 on hover, mono data cells. */
.table_all_funds {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-surface;
  max-width: 100%;
  // add table max height
  :deep(.v-table__wrapper) {
    overflow-x: auto;

    /* Hairline scrollbar rather than the shared mixin's brand-blue thumb on a
       grey track: a styled scrollbar is always painted, so at the widths where
       the table only just overflows that bar reads as a blue rule ruled under
       the last row instead of as a scrollbar. */
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: $color-line-3;
      border-radius: 16px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: $color-steel-blue;
    }

    table {
      table-layout: fixed;
      background: transparent;
      /* Data columns keep their designed widths and the name column takes
         whatever is left, so the card fits a normal desktop without scrolling;
         below this width it scrolls horizontally (design-file behavior). */
      min-width: 1130px;
    }

    thead th {
      height: 46px !important;
      font-size: 11px;
      letter-spacing: 0.1em;
      white-space: nowrap;
      color: $color-steel-blue;
      background: transparent;
      border-bottom: 1px solid $color-line !important;

      /* Sort arrow always sits AFTER the label (Vuetify reverses it
         on right-aligned columns), and only appears on hover — the
         hover state reveals the current sort direction. */
      .v-data-table-header__content {
        gap: 4px;
      }
      &.v-data-table-column--align-end .v-data-table-header__content,
      .v-data-table-header__content {
        flex-direction: row;
      }
      /* row (not row-reverse) breaks Vuetify's alignment trick, so
         restore each alignment explicitly to match the cells below. */
      &.v-data-table-column--align-end .v-data-table-header__content {
        justify-content: flex-end;
      }
      &.v-data-table-column--align-center .v-data-table-header__content {
        justify-content: center;
      }
      &.v-data-table-column--align-start .v-data-table-header__content {
        justify-content: flex-start;
      }
      /* Negative end-margin cancels the icon's own width + the gap, so
         the hidden icon takes no layout space and labels line up
         exactly with the values below. */
      .v-data-table-header__sort-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        margin-inline-end: -18px;
        opacity: 0 !important;
        transition: opacity 0.2s ease;
      }
      &:hover .v-data-table-header__sort-icon {
        opacity: 1 !important;
      }
      /* On the last column that pull would push the icon 2px past the table's
         right edge (18px pull against 16px of cell padding), which is enough
         overflow to keep the horizontal scrollbar on screen. Clamp it to the
         padding; the 2px of label alignment lost is not visible. */
      &:last-child .v-data-table-header__sort-icon {
        margin-inline-end: -16px;
      }
    }

    .v-data-table__tr {
      height: 72px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      color: $color-light-subtitle;
      background-color: transparent;

      &:hover {
        background-color: $color-navy-gray-light;
        box-shadow: none;
      }
    }
    .v-data-table__td {
      border-color: $color-line !important;
    }

    /* Curator column (3rd) sits a touch further right for breathing
       room after the right-aligned NAV figures. */
    thead th:nth-child(3),
    tbody td:nth-child(3) {
      padding-left: 28px;
    }

    /* Numeric data cells in mono (design-file rows) */
    .nav_cell,
    .nav_usd_value {
      font-family: $font-mono;
      font-size: 13.5px;
    }
    /* Was Vuetify's text-white utility — literal white, invisible on the
       light theme's white card. */
    .nav_cell__value {
      color: $color-title;
    }
    /* Cumulative return + APR columns */
    tbody .v-data-table__td:nth-last-child(-n + 2) {
      font-family: $font-mono;
      font-size: 13.5px;
    }
    .text-success {
      color: $color-pos !important;
    }
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }

  &__skeleton_loader :deep(*) {
    margin: 0;
  }

  &__header_cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.nav_usd_value {
  color: $color-steel-blue;
  font-size: 11.5px;
}

.loading_skeleton {
  background-color: $color-table-row;

  .skeleton {
    background-color: $color-table-row;
  }
}

.copy-icon {
  margin-bottom: -0.2rem;
  cursor: pointer;
  color: $color-steel-blue;

  rotate: 180deg;
  transform: scaleX(-1);
}

.position_types_bar {
  max-width: 100px;
  margin-left: auto;
}

.curator-cell {
  font-size: 13px;
  color: $color-text-irrelevant;
}

/* Icon + trend cells centre under their centred headers. */
.sparkline-cell,
.chain-cell {
  display: flex;
  justify-content: center;
}

.base-asset-cell {
  display: flex;
  align-items: center;
  justify-content: center;

  &__symbol {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
  }
}
</style>
