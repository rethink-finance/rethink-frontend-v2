<template>
  <div class="calc">
    <div class="calc__grid">
      <div class="calc__inputs">
        <div class="calc__field">
          <label class="calc__label" for="calc-amount">How much do you want to stake?</label>
          <div class="calc__amount-row">
            <input
              id="calc-amount"
              v-model="amountInput"
              class="calc__amount"
              type="number"
              inputmode="decimal"
              :min="asset.min"
              :step="asset.step"
            >
            <StakingAssetTabs v-model="symbol" size="small" />
          </div>
          <!-- Keyed per asset: patching min/max after the value would clamp it
               against the previous asset's range. -->
          <input
            :key="asset.symbol"
            v-model.number="slider"
            class="calc__slider"
            type="range"
            :min="asset.sliderMin"
            :max="asset.sliderMax"
            :step="asset.sliderStep"
            :aria-label="`${asset.symbol} to stake`"
            :style="{ '--fill': sliderFill }"
          >
        </div>

        <div class="calc__field">
          <span id="calc-fdv" class="calc__label">REFI valuation at launch</span>
          <div class="calc__options" role="group" aria-labelledby="calc-fdv">
            <button
              v-for="scenario in VENTURE_STAKING.fdvScenarios"
              :key="scenario.fdvMillions"
              type="button"
              class="calc__option"
              :class="{ 'calc__option--active': scenario.fdvMillions === fdv }"
              :aria-pressed="scenario.fdvMillions === fdv"
              @click="fdv = scenario.fdvMillions"
            >
              <span class="calc__option-price">{{ formatPrice(priceAt(scenario.fdvMillions)) }}</span>
              <span class="calc__option-sub">per REFI · ${{ scenario.fdvMillions }}M</span>
              <span class="calc__option-name">{{ scenario.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="calc__result" aria-live="polite">
        <span class="calc__caption">After one year</span>

        <div class="calc__rows">
          <div class="calc__row">
            <span class="calc__row-icon"><Icon icon="mdi:shield-check-outline" width="1.25rem" /></span>
            <span class="calc__row-label">You keep</span>
            <span class="calc__row-value">
              {{ projection ? `${formatAmount(amount, asset.displayDecimals)} ${asset.symbol}` : DASH }}
            </span>
            <span class="calc__row-note">{{ projection ? formatUsd(projection.amountUsd) : "" }}</span>
          </div>
          <div class="calc__row calc__row--earn">
            <span class="calc__row-icon"><StakingRefiMark :size="22" /></span>
            <span class="calc__row-label">You earn</span>
            <span class="calc__row-value calc__row-value--earn">
              {{ projection ? formatUsd(projection.valueUsd) : DASH }}
            </span>
            <span class="calc__row-note">{{ projection ? `${formatCompact(projection.refi12)} REFI` : "" }}</span>
          </div>
        </div>

        <div v-if="projection" class="calc__compare">
          <span class="calc__compare-title">
            <strong>{{ formatMultiple(projection.multipleVsYield) }}</strong> the {{ asset.yieldLabel }} you give up
          </span>
          <div class="calc__bar-row">
            <span class="calc__bar-label">{{ capitalize(asset.yieldLabel) }}</span>
            <span class="calc__bar calc__bar--yield" :style="{ width: barWidth(projection.yieldRedirectedUsd) }" />
            <span class="calc__bar-value">{{ formatUsd(projection.yieldRedirectedUsd) }}</span>
          </div>
          <div class="calc__bar-row">
            <span class="calc__bar-label">REFI</span>
            <span class="calc__bar calc__bar--refi" :style="{ width: barWidth(projection.valueUsd) }" />
            <span class="calc__bar-value">{{ formatUsd(projection.valueUsd) }}</span>
          </div>
        </div>

        <div class="calc__ctas">
          <v-btn
            color="primary"
            size="large"
            class="calc__btn"
            :disabled="!projection"
            @click="emit('stake', asset.symbol, amount)"
          >
            Stake {{ projection ? `${formatAmount(amount, asset.displayDecimals)} ` : "" }}{{ asset.symbol }}
          </v-btn>
          <a
            class="calc__terms"
            :href="VENTURE_STAKING_TERMS_URL"
            target="_blank"
            rel="noopener"
          >
            Read the full terms
          </a>
        </div>
      </div>
    </div>

    <div class="calc__details">
      <button
        type="button"
        class="calc__toggle"
        :aria-expanded="showBreakdown"
        aria-controls="calc-breakdown"
        @click="showBreakdown = !showBreakdown"
      >
        How this is calculated
        <Icon :icon="showBreakdown ? 'mdi:chevron-up' : 'mdi:chevron-down'" width="1.1rem" />
      </button>
      <dl v-show="showBreakdown" id="calc-breakdown" class="calc__breakdown">
        <div class="calc__breakdown-row">
          <dt>Stage you enter</dt>
          <dd>
            {{ projection ? `${projection.tier.name}, ${projection.tier.baseMultiplier}x points` : DASH }}
          </dd>
        </div>
        <div class="calc__breakdown-row">
          <dt>Staked ahead of you</dt>
          <dd>{{ projection ? formatUsdCompact(projection.existingUsd) : DASH }}</dd>
        </div>
        <div v-if="asset.symbol !== 'ETH'" class="calc__breakdown-row">
          <dt>Points weight, by yield</dt>
          <dd>{{ projection ? `${projection.yieldWeight.toFixed(2)}x a dollar of ETH` : DASH }}</dd>
        </div>
        <div class="calc__breakdown-row">
          <dt>Your share of month-1 points</dt>
          <dd>{{ projection ? formatShare(projection.monthOneShare) : DASH }}</dd>
        </div>
        <p v-if="projection" class="calc__equation">
          {{ formatInt(projection.refi12) }} REFI × {{ formatPrice(projection.pricePerRefi) }}
          = {{ formatUsd(projection.valueUsd) }}
        </p>
      </dl>
    </div>

    <p class="calc__fine">
      A projection, not a promise: {{ poolSentence }}, held flat for a year. REFI has no price before launch.
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  DASH,
  formatAmount,
  formatCompact,
  formatInt,
  formatUsd,
  formatUsdCompact,
} from "~/composables/staking/formatStaking";
import { projectVentureStake } from "~/composables/staking/ventureStaking";
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  VENTURE_STAKING_TERMS_URL,
  type VentureAsset,
} from "~/composables/staking/ventureStakingConfig";

type AssetSymbol = VentureAsset["symbol"];

const props = defineProps<{
  /** USD deposited so far at deposit-time value; 0 before launch or when the read fails. */
  poolUsd: number;
  /** The pool's yield per dollar against ETH's (1 for an all-ETH pool). */
  poolYieldWeight?: number;
  /** The asset picked in the deposit card; the calculator opens on it. */
  initialSymbol?: AssetSymbol;
}>();

const emit = defineEmits<{ stake: [symbol: AssetSymbol, amount: number] }>();

const assetFor = (symbol?: AssetSymbol) =>
  VENTURE_STAKING_ASSETS.find((option) => option.symbol === symbol) ?? VENTURE_STAKING_ASSETS[0];

const asset = ref<VentureAsset>(assetFor(props.initialSymbol));
const amountInput = ref<string | number>(asset.value.defaultAmount);
const slider = ref<number>(asset.value.defaultAmount);
const fdv = ref<number>(VENTURE_STAKING.defaultFdvMillions);
const showBreakdown = ref(false);

const amount = computed(() =>
  amountInput.value === "" ? NaN : Number(amountInput.value),
);

/** Each asset starts from its own default, sized near 10 ETH. */
const selectAsset = (option: VentureAsset) => {
  if (option.symbol === asset.value.symbol) return;
  asset.value = option;
  amountInput.value = option.defaultAmount;
  slider.value = option.defaultAmount;
};

/** The asset switch speaks symbols; the calculator keeps the whole asset. */
const symbol = computed({
  get: () => asset.value.symbol,
  set: (value: AssetSymbol) => selectAsset(assetFor(value)),
});

watch(() => props.initialSymbol, (value) => {
  if (value) selectAsset(assetFor(value));
});

// The slider follows the field only while the field is inside its range.
watch(amount, (value) => {
  const { sliderMin, sliderMax } = asset.value;
  if (value >= sliderMin && value <= sliderMax && value !== slider.value) slider.value = value;
});
watch(slider, (value) => {
  if (value !== amount.value) amountInput.value = value;
});

const sliderFill = computed(() => {
  const { sliderMin, sliderMax } = asset.value;
  const ratio = (slider.value - sliderMin) / (sliderMax - sliderMin);
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
});

const projection = computed(() =>
  projectVentureStake({
    asset: asset.value,
    amount: amount.value,
    livePoolUsd: props.poolUsd,
    poolYieldWeight: props.poolYieldWeight,
    fdvMillions: fdv.value,
  }),
);

const priceAt = (fdvMillions: number) => (fdvMillions * 1e6) / VENTURE_STAKING.supply;

/** Both comparison bars share one scale: the larger of the two fills it. */
const barWidth = (usd: number) => {
  const p = projection.value;
  if (!p) return "0%";
  const max = Math.max(p.valueUsd, p.yieldRedirectedUsd);
  return `${Math.max((usd / max) * 100, 1.5)}%`;
};

const poolSentence = computed(() =>
  props.poolUsd > 0
    ? `${formatUsdCompact(props.poolUsd)} staked so far`
    : `${formatUsdCompact(VENTURE_STAKING.assumedLaunchPoolUsd)} assumed at launch`,
);

const formatPrice = (value: number) => `$${value.toFixed(2)}`;

const formatShare = (share: number) =>
  `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;

const formatMultiple = (multiple: number) =>
  `${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}x`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
</script>

<style scoped lang="scss">
.calc {
  display: flex;
  flex-direction: column;

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__inputs {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.75rem;
    border-right: 1px solid $color-line;

    @media (max-width: $screen-lg) {
      border-right: 0;
      border-bottom: 1px solid $color-line;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  &__label {
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__amount-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__amount {
    flex: 1 1 8rem;
    min-width: 0;
    // Out-states the global `:root input` height and padding.
    min-height: 0;
    height: auto;
    padding: 0 0 0.375rem;
    border-bottom: 1px solid $color-line-2;
    font-family: $font-mono;
    font-size: 2.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: $color-title;
    outline: none;
    -moz-appearance: textfield;
    transition: border-color $default-transition-time;

    &:focus {
      border-color: $color-primary;
    }

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }

  &__slider {
    width: 100%;
    height: 6px;
    min-height: 0;
    padding: 0;
    margin: 0.25rem 0 0;
    border-radius: 3px;
    background: linear-gradient(to right, $color-primary var(--fill), var(--fill-2) var(--fill));
    appearance: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 18px;
      border: 3px solid $color-primary;
      border-radius: 50%;
      background: var(--text);
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border: 3px solid $color-primary;
      border-radius: 50%;
      background: var(--text);
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
      outline-offset: 6px;
    }
  }

  &__options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  &__option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    text-align: left;
    transition: border-color $default-transition-time, background $default-transition-time;

    &:hover {
      border-color: $color-line-3;
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
      outline-offset: 2px;
    }

    &--active {
      border-color: $color-primary;
      background: $color-accent-soft;
    }
  }

  &__option-price {
    font-family: $font-mono;
    font-size: 1.125rem;
    font-weight: 600;
    color: $color-title;
  }

  &__option-sub {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
  }

  &__option-name {
    margin-top: 0.25rem;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__option--active &__option-name {
    color: $color-blue-bright;
  }

  &__result {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.75rem;
  }

  &__caption {
    font-family: $font-mono;
    font-size: $text-xs;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-subtitle;
  }

  &__rows {
    display: flex;
    flex-direction: column;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "icon label note"
      "icon value value";
    align-items: center;
    column-gap: 0.875rem;
    row-gap: 0.125rem;
    padding: 1rem 1.125rem;

    &--earn {
      border-top: 1px solid $color-line;
      border-radius: 0 0 $default-border-radius $default-border-radius;
      background: $color-cyan-tint;
    }
  }

  &__row-icon {
    grid-area: icon;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid $color-line-2;
    border-radius: 50%;
    color: $color-title;
  }

  &__row--earn &__row-icon {
    border-color: $color-cyan-line;
  }

  &__row-label {
    grid-area: label;
    font-size: $text-sm;
    color: $color-subtitle;
  }

  &__row-value {
    grid-area: value;
    font-family: $font-mono;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.15;
    color: $color-title;

    &--earn {
      font-size: 2.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: $color-cyan;
    }
  }

  &__row-note {
    grid-area: note;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__compare {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__compare-title {
    font-size: $text-sm;
    color: $color-subtitle;

    strong {
      font-family: $font-mono;
      font-weight: 700;
      color: $color-cyan;
    }
  }

  &__bar-row {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__bar {
    display: block;
    height: 8px;
    border-radius: 4px;

    &--yield {
      background: var(--fill-3);
      box-shadow: inset 0 0 0 1px $color-line-3;
    }

    &--refi {
      background: $gradient-brand;
    }
  }

  &__bar-label {
    white-space: nowrap;
  }

  &__bar-value {
    font-family: $font-mono;
    color: $color-title;
  }

  &__ctas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.25rem;
    margin-top: 0.25rem;
  }

  &__btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }

  &__terms {
    font-size: $text-sm;
    color: $color-subtitle;
    text-decoration: underline;
    text-underline-offset: 3px;

    &:hover {
      color: $color-title;
    }
  }

  &__details {
    border-top: 1px solid $color-line;
  }

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 1rem 1.75rem;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;

    &:focus-visible {
      outline: 1px solid var(--accent-line);
      outline-offset: -2px;
    }
  }

  &__breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1.75rem 1.25rem;
    font-size: $text-sm;
  }

  &__breakdown-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;

    dt {
      color: $color-subtitle;
    }

    dd {
      font-family: $font-mono;
      color: $color-title;
      text-align: right;
    }
  }

  &__equation {
    margin: 0.5rem 0 0;
    padding: 0.75rem 1rem;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    color: $color-title;
  }

  &__fine {
    margin: 0;
    padding: 1rem 1.75rem 1.25rem;
    border-top: 1px solid $color-line;
    font-size: $text-xs;
    line-height: 1.6;
    color: $color-subtitle;
  }

  @media (max-width: $screen-sm) {
    &__inputs,
    &__result {
      padding: 1.25rem;
    }

    &__toggle {
      padding: 1rem 1.25rem;
    }

    &__breakdown,
    &__fine {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }

    &__option {
      padding: 0.625rem;
    }

    &__option-price {
      font-size: 1rem;
    }

    &__option-sub {
      font-size: 10px;
    }

    &__bar-row {
      grid-template-columns: 5rem minmax(0, 1fr) auto;
    }

    &__btn {
      flex: 1 1 100%;
    }
  }
}
</style>
