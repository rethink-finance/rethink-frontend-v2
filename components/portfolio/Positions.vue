<template>
  <div class="positions brand_card">
    <div class="positions__head">
      <div class="brand_card__eyebrow">
        Positions
      </div>
      <UiSegmented v-model="view" :options="VIEW_OPTIONS" />
    </div>

    <div v-if="isLoading" class="positions__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Reading your positions…
    </div>

    <!-- An empty table with its headings still up reads as a rendering fault.
         A wallet with nothing in it gets the header and nothing else. -->
    <template v-else-if="positions.length">
      <PortfolioPositionsPie
        v-if="view === 'pie'"
        :positions="positions"
        @open="openPosition"
      />

      <div v-else class="positions__scroll">
        <div class="positions__table">
          <div class="positions__head_row">
            <div class="positions__th">
              Position
            </div>
            <div class="positions__th">
              Chain
            </div>
            <div class="positions__th positions__th--right">
              Vault tokens
            </div>
            <div class="positions__th positions__th--right">
              Value
            </div>
            <div class="positions__th positions__th--allocation">
              Allocation
            </div>
            <div class="positions__th positions__th--right">
              Return
            </div>
          </div>

          <PortfolioPositionGroup
            v-for="row in rows"
            :key="row.position.key"
            :row="row.view"
            :attention="row.attention"
            @open="openPosition(row.position.key)"
            @vote="openVote(row.position, $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatNumberShort, formatTokenValue } from "~/composables/formatters";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import type { PricedPosition } from "~/composables/portfolioPositions";
import type { PositionAttention } from "~/composables/portfolioAttention";
import type IPortfolioPositionRow from "~/types/portfolio_position_row";

/**
 * Everything the wallet holds, as a table of vaults or a ring of shares.
 *
 * Allocation here is share of the *portfolio*, not share of the vault: the
 * question this screen answers is where the wallet's money is, not how much of
 * each vault it owns.
 */
const props = defineProps<{
  positions: PricedPosition[];
  attention: Record<string, PositionAttention>;
  isLoading: boolean;
}>();

const VIEW_OPTIONS = [
  { key: "table", label: "Table" },
  { key: "pie", label: "Pie" },
];
const view = ref("table");

const router = useRouter();
const { getFundDetailsUrl } = usePageNavigation();

const EMPTY_ATTENTION: PositionAttention = { requests: [], votes: [] };

const totalUSD = computed(() =>
  props.positions.reduce((sum, position) => sum + (position.valueUSD ?? 0), 0),
);

const rows = computed(() =>
  props.positions.map((position) => {
    const { fund } = position;
    // Allocation is a share of one total, so a position with no dollar value
    // cannot have one — showing 0.0% would read as "nothing", when the truth
    // is "not priced". The bar is left empty and the figure withheld.
    const share =
      position.valueUSD && totalUSD.value
        ? (position.valueUSD / totalUSD.value) * 100
        : undefined;
    const percent = position.returnPercent;

    const view: IPortfolioPositionRow = {
      key: position.key,
      chainId: fund.chainId,
      chainShort: fund.chainShort,
      photoUrl: fund.photoUrl,
      symbol: fund.fundToken?.symbol ?? "",
      title: fund.title,
      curator: fund.strategistName || fund.fundToken?.symbol || "",
      baseSymbol: fund.baseToken?.symbol ?? "",
      baseDecimals: fund.baseToken?.decimals ?? 18,
      shareDecimals: fund.fundToken?.decimals ?? 18,
      tokens: `${formatTokenValue(position.shares, fund.fundToken?.decimals, true, true)} ${fund.fundToken?.symbol ?? ""}`.trim(),
      value: formatTokenValue(
        position.valueRaw,
        fund.baseToken?.decimals,
        true,
        true,
      ),
      valueUSD: position.valueUSD ? `$${formatNumberShort(position.valueUSD)}` : "",
      allocation: share === undefined ? "—" : `${share.toFixed(1)}%`,
      allocationWidth: share === undefined ? "0%" : `${share.toFixed(1)}%`,
      // A wallet with no measurable cost — withdrawn more than went in, or a
      // vault that was never priced — see measureFlows in portfolioSeries.
      return: percent === undefined ? "—" : `${percent.toFixed(2)}%`,
      // A figure that rounds to nothing is written unsigned and uncoloured, so
      // a rounding artefact cannot masquerade as a direction.
      returnTone:
        percent === undefined || Math.abs(percent) < 0.005
          ? ""
          : percent > 0
            ? "pos"
            : "neg",
    };

    return {
      position,
      view,
      attention: props.attention[position.key] ?? EMPTY_ATTENTION,
    };
  }),
);

const positionUrl = (position: PortfolioPosition) =>
  getFundDetailsUrl(
    position.fund.chainId,
    position.fund.fundToken.symbol,
    position.fund.address,
  );

const openPosition = (key: string) => {
  const position = props.positions.find((entry) => entry.key === key);
  if (position) router.push(positionUrl(position));
};

/** Straight to the proposal, which is where the vote is actually cast. */
const openVote = (position: PortfolioPosition, proposalId: string) => {
  router.push(`${positionUrl(position)}/governance/proposal/${proposalId}`);
};
</script>

<style lang="scss" scoped>
.positions {
  /* The rows carry their own padding so their hover and tint reach the card's
     edges — anything else leaves a gutter the highlight stops short of. */
  padding: 0;

  --position-columns: minmax(240px, 1.5fr) 76px 150px 170px minmax(130px, 1fr) 100px;

  &__head {
    display: flex;
    align-items: center;
    gap: 1.125rem;
    flex-wrap: wrap;
    padding: 1.25rem 1.5rem 1rem;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 1.5rem 1.5rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  /* Six columns do not fit a laptop at a legible size, so the table scrolls
     inside the card rather than the page scrolling under it. */
  &__scroll {
    overflow-x: auto;
  }

  &__table {
    min-width: 1000px;
  }

  &__head_row {
    display: grid;
    grid-template-columns: var(--position-columns);
    align-items: center;
    height: 46px;
    padding: 0 1.5rem;
    border-bottom: 1px solid $color-line;
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }

    /* Sits over the bar, not over the track's left edge. */
    &--allocation {
      padding-left: 1.25rem;
    }
  }
}
</style>
