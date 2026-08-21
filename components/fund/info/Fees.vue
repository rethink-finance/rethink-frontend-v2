<template>
  <div class="fund_fees brand_card">
    <div class="brand_card__eyebrow fund_fees__title">
      Fees
    </div>
    <div class="fund_fees__table">
      <div class="fund_fees__grid fund_fees__grid--head">
        <div class="fund_fees__th">
          Type
        </div>
        <div class="fund_fees__th fund_fees__th--right">
          Rate
        </div>
        <div class="fund_fees__th fund_fees__th--right">
          Recipient
        </div>
      </div>
      <div v-for="row in feeRows" :key="row.label" class="fund_fees__grid">
        <div class="fund_fees__label">
          {{ row.label }}
        </div>
        <div class="fund_fees__value">
          {{ row.value }}
        </div>
        <div class="fund_fees__recipient">
          <AddressLink
            v-if="row.hasFee && row.recipient && !isZeroAddress(row.recipient)"
            :address="row.recipient"
            :chain-id="fund.chainId"
            truncate
          />
          <span v-else>N/A</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";
import { isZeroAddress } from "~/composables/addressUtils";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

/** Fees are stored in basis points; the design shows plain percentages. */
const formatFee = (feeBps?: string) => {
  if (feeBps === undefined || feeBps === null) return "N/A";
  return `${Number(feeBps) / 100}%`;
};

/**
 * Accrual periods are annual unless a vault says otherwise ("0" in the
 * contracts also means the default year), so the period is only worth the
 * space when it deviates — a row reading "25% · 365 days" says nothing the
 * reader did not already assume.
 */
const DEFAULT_PERIOD_DAYS = 365;

const formatRate = (feeBps?: string, period?: string) => {
  const rate = formatFee(feeBps);
  const days = Number(period);
  if (!days || days === DEFAULT_PERIOD_DAYS) return rate;
  return `${rate} · ${days} ${days === 1 ? "day" : "days"}`;
};

/**
 * A recipient only means something when there is a fee to receive. A vault
 * that leaves a collector address configured at a 0% rate still collects
 * nothing, so the address would read as a claim the numbers contradict.
 */
const hasFee = (feeBps?: string) => Number(feeBps) > 0;

const feeRows = computed(() => [
  {
    label: "Performance fee",
    value: formatRate(props.fund?.performanceFee, props.fund?.performancePeriod),
    recipient: props.fund?.performanceFeeAddress,
    hasFee: hasFee(props.fund?.performanceFee),
  },
  {
    label: "Management fee",
    value: formatRate(props.fund?.managementFee, props.fund?.managementPeriod),
    recipient: props.fund?.managementFeeAddress,
    hasFee: hasFee(props.fund?.managementFee),
  },
  {
    label: "Deposit fee",
    value: formatFee(props.fund?.depositFee),
    recipient: props.fund?.depositFeeAddress,
    hasFee: hasFee(props.fund?.depositFee),
  },
  {
    label: "Redemption fee",
    value: formatFee(props.fund?.withdrawFee),
    recipient: props.fund?.withdrawFeeAddress,
    hasFee: hasFee(props.fund?.withdrawFee),
  },
]);
</script>

<style lang="scss" scoped>
.fund_fees {
  &__title {
    margin-bottom: 1rem;
  }

  &__table {
    display: flex;
    flex-direction: column;
  }

  /* Half-width once it is paired with the contracts card, so it cannot carry
     the overview's four tracks — those alone are wider than the whole card.
     Fixed figure columns instead of content-sized ones: each row is its own
     grid, so an auto column sizes to that row alone and "0.2%" would sit off
     the "10%" above it. */
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 56px 116px;
    align-items: center;
    column-gap: 1.5rem;
    padding: 0.75rem 0;
    border-top: 1px solid $color-line;

    &--head {
      padding: 0 0 0.625rem;
      border-top: 0;
    }
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
  }

  &__label {
    font-size: 13.5px;
    color: $color-text-irrelevant;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__recipient {
    display: flex;
    justify-content: flex-end;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;

    :deep(.address-link) {
      font-size: inherit;
      color: $color-text-irrelevant;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-cyan;
        text-decoration: none;
      }
    }
  }
}
</style>
