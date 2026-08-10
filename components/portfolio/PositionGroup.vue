<template>
  <div
    class="position_group"
    :class="{ 'position_group--attention': needsAttention }"
  >
    <div class="position_group__row" @click="emit('open')">
      <div class="position_group__vault">
        <UiVaultTile
          :image="row.photoUrl"
          :symbol="row.symbol"
          :size="38"
        />
        <div class="position_group__vault_text">
          <div class="position_group__title">
            {{ row.title }}
          </div>
          <div class="position_group__curator">
            {{ row.curator }}
          </div>
        </div>
      </div>

      <div class="position_group__chain">
        <IconChain :chain-id="row.chainId" :chain-short="row.chainShort" />
      </div>

      <div class="position_group__tokens">
        {{ row.tokens }}
      </div>

      <div class="position_group__value">
        <div class="position_group__value_base">
          <IconBaseAsset :symbol="row.baseSymbol" :size="15" />
          <span>{{ row.value }}</span>
        </div>
        <div v-if="row.valueUSD" class="position_group__value_usd">
          {{ row.valueUSD }}
        </div>
      </div>

      <div class="position_group__allocation">
        <div class="position_group__track">
          <div
            class="position_group__fill"
            :style="{ width: row.allocationWidth }"
          />
        </div>
        <span class="position_group__allocation_value">
          {{ row.allocation }}
        </span>
      </div>

      <div
        class="position_group__return"
        :class="row.returnTone && `position_group__return--${row.returnTone}`"
      >
        {{ row.return }}
      </div>
    </div>

    <!-- Votes before requests: a vote has a deadline someone else set, a
         request waits as long as it needs to. -->
    <div
      v-for="vote in attention.votes"
      :key="vote.proposalId"
      class="position_group__sub"
    >
      <span class="position_group__elbow" />
      <span class="position_group__dot position_group__dot--vote" />
      <span class="position_group__sub_kind">Proposal</span>
      <span class="position_group__sub_title">{{ vote.title }}</span>
      <span class="position_group__sub_status position_group__sub_status--cyan">
        Needs your vote
      </span>
      <span v-if="vote.endsAt" class="position_group__sub_meta">
        Ends {{ formatDate(new Date(vote.endsAt)) }}
      </span>
      <div class="position_group__spacer" />
      <button
        type="button"
        class="position_group__action position_group__action--primary"
        @click.stop="emit('vote', vote.proposalId)"
      >
        Vote
      </button>
    </div>

    <div
      v-for="request in attention.requests"
      :key="request.kind"
      class="position_group__sub"
    >
      <span class="position_group__elbow" />
      <span
        class="position_group__dot"
        :class="request.isSettled ? 'position_group__dot--ready' : 'position_group__dot--waiting'"
      />
      <span class="position_group__sub_kind">
        {{ request.kind === "deposit" ? "Deposit request" : "Redemption request" }}
      </span>
      <span class="position_group__sub_amount">
        {{ requestAmount(request) }}
      </span>
      <span
        class="position_group__sub_status"
        :class="request.isSettled ? 'position_group__sub_status--cyan' : ''"
      >
        {{ request.isSettled ? "Settled - ready to process" : "Awaiting settlement" }}
      </span>
      <div class="position_group__spacer" />
      <button
        type="button"
        class="position_group__action"
        :class="request.isSettled ? 'position_group__action--primary' : ''"
        @click.stop="emit('open')"
      >
        {{ request.isSettled ? "Process" : "Manage" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate, formatTokenValue } from "~/composables/formatters";
import type { PendingRequest, PositionAttention } from "~/composables/portfolioAttention";
import type IPortfolioPositionRow from "~/types/portfolio_position_row";

/**
 * One vault the wallet holds, with whatever that vault is waiting on it for
 * nested underneath.
 *
 * The nesting is the point of the screen: an outstanding vote or request
 * belongs to the position it concerns, not to a banner at the top of the page
 * that has to name the vault all over again. Groups with nothing outstanding
 * stay untinted, so the tinted ones read as "these need you".
 */
const props = defineProps<{
  row: IPortfolioPositionRow;
  attention: PositionAttention;
}>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "vote", proposalId: string): void;
}>();

const needsAttention = computed(
  () => props.attention.votes.length > 0 || props.attention.requests.length > 0,
);

/** A deposit is requested in the base asset, a redemption in vault shares. */
const requestAmount = (request: PendingRequest) => {
  const isDeposit = request.kind === "deposit";
  const decimals = isDeposit ? props.row.baseDecimals : props.row.shareDecimals;
  const symbol = isDeposit ? props.row.baseSymbol : props.row.symbol;
  return `${formatTokenValue(request.amount, decimals, true, true)} ${symbol}`.trim();
};
</script>

<style lang="scss" scoped>
/* --position-columns is set by the Positions card that owns the header row.
   Both have to resolve to the same track list or the columns drift apart, and
   only one of them can own it. */
.position_group {
  border-top: 1px solid $color-line;

  /* A 2px rail rather than a full border: it marks the group down its left
     edge without boxing it in, so a run of tinted groups still reads as rows
     of one table. */
  &--attention {
    background: $color-navy-gray-light;
    box-shadow: inset 2px 0 0 $color-accent-line;
  }

  &__row {
    display: grid;
    grid-template-columns: var(--position-columns);
    align-items: center;
    padding: 0.875rem 1.5rem;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover {
      background-color: $color-bg-transparent;
    }
  }

  &__vault {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-width: 0;
    padding-right: 1rem;
  }

  &__vault_text {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: $color-white;
    @include ellipsis;
  }

  &__curator {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    @include ellipsis;
  }

  &__chain {
    display: flex;
    align-items: center;
  }

  &__tokens {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-text-irrelevant;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1875rem;
  }

  &__value_base {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-family: $font-mono;
    font-size: 13.5px;
    color: $color-white;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__value_usd {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__allocation {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-left: 1.25rem;
  }

  &__track {
    flex: 1;
    min-width: 40px;
    height: 5px;
    border-radius: 999px;
    background: $color-hover;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    background: $color-cyan;
  }

  &__allocation_value {
    /* Fixed slot so the bars all end on the same line however wide the
       percentages beside them are. */
    width: 46px;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__return {
    font-family: $font-mono;
    font-size: 13.5px;
    text-align: right;
    white-space: nowrap;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;

    &--pos {
      color: $color-pos;
    }

    &--neg {
      color: $color-neg;
    }
  }

  &__sub {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    flex-wrap: wrap;
    /* Indented to sit under the vault name rather than the tile, and with no
       border of its own — it shares the group's tint. */
    padding: 0 1.5rem 0.8125rem 2.6875rem;
  }

  /* Hangs off the tile above, so the sub-row reads as belonging to it. */
  &__elbow {
    flex: none;
    width: 15px;
    height: 9px;
    margin-top: -9px;
    border-left: 1px solid $color-line-2;
    border-bottom: 1px solid $color-line-2;
    border-bottom-left-radius: $default-border-radius;
  }

  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    margin-left: -4px;
    border-radius: 999px;
    background: $color-steel-blue;

    &--vote,
    &--ready {
      background: $color-cyan;
    }

    /* The only shadow in the design: a vote is the one thing here with
       someone else's deadline on it. */
    &--vote {
      box-shadow: 0 0 8px $color-cyan-glow;
    }
  }

  &__sub_kind {
    font-size: 13px;
    color: $color-text-irrelevant;
  }

  &__sub_title {
    min-width: 0;
    max-width: 380px;
    font-size: 13px;
    color: $color-white;
    @include ellipsis;
  }

  &__sub_amount {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__sub_status,
  &__sub_meta {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__sub_status--cyan {
    color: $color-cyan;
  }

  &__spacer {
    flex: 1;
  }

  &__action {
    padding: 0.375rem 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-text-irrelevant;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    &--primary {
      border-color: $color-accent-line;
      background: $color-accent-soft;
      color: $color-cyan;
    }
  }
}
</style>
