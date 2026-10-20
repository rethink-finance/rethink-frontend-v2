<template>
  <div class="calc">
    <div>
      <div class="calc__grid">
        <div class="calc__inputs">
          <div class="calc__field">
            <label class="calc__label" for="calc-amount">
              <span class="calc__step">01</span> I stake
            </label>
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
              <div class="calc__assets" role="group" aria-label="Asset to stake">
                <button
                  v-for="option in VENTURE_STAKING_ASSETS"
                  :key="option.symbol"
                  type="button"
                  class="calc__asset"
                  :class="{ 'calc__asset--active': option.symbol === asset.symbol }"
                  :aria-pressed="option.symbol === asset.symbol"
                  @click="selectAsset(option)"
                >
                  {{ option.symbol }}
                </button>
              </div>
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
            <span id="calc-fdv" class="calc__label">
              <span class="calc__step">02</span> Fully Diluted Valuation at Token Launch
            </span>
            <div class="calc__fdv" role="group" aria-labelledby="calc-fdv">
              <button
                v-for="scenario in VENTURE_STAKING.fdvScenarios"
                :key="scenario.fdvMillions"
                type="button"
                class="calc__fdv-option"
                :class="{ 'calc__fdv-option--active': scenario.fdvMillions === fdv }"
                :aria-pressed="scenario.fdvMillions === fdv"
                @click="fdv = scenario.fdvMillions"
              >
                <span class="calc__fdv-value">${{ scenario.fdvMillions }}M</span>
                <span class="calc__fdv-label">{{ scenario.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="calc__result" aria-live="polite">
          <span class="calc__caption">After one year you have</span>

          <div class="calc__ledger">
            <div class="calc__line calc__line--principal">
              <span class="calc__line-icon"><Icon icon="mdi:shield-check-outline" width="1.375rem" /></span>
              <div class="calc__line-body">
                <span class="calc__line-label">Your principal, untouched</span>
                <span class="calc__line-value">
                  <template v-if="projection">
                    {{ formatAmount(amount, asset.displayDecimals) }} {{ asset.symbol }}
                    <small>{{ formatUsd(projection.amountUsd) }}</small>
                  </template>
                  <template v-else>
                    {{ DASH }}
                  </template>
                </span>
                <span class="calc__line-note">100% stays yours. Withdraw it any settlement cycle.</span>
              </div>
              <span class="calc__tag">Kept</span>
            </div>

            <div class="calc__plus" aria-hidden="true">
              <Icon icon="mdi:plus" width="1rem" />
            </div>

            <div class="calc__line calc__line--bonus">
              <span class="calc__line-icon"><StakingRefiMark :size="26" /></span>
              <div class="calc__line-body">
                <span class="calc__line-label">Your REFI after the first year would be worth</span>
                <span class="calc__hero">
                  {{ projection ? formatUsd(projection.valueUsd) : DASH }}
                </span>
                <span class="calc__line-note">
                  <template v-if="projection">
                    {{ formatCompact(projection.refi12) }} REFI in the ${{ fdv }}M scenario,
                    {{ projection.tier.name }} tier at {{ projection.tier.baseMultiplier }}x
                  </template>
                  <template v-else>
                    Enter how much {{ asset.symbol }} you would stake.
                  </template>
                </span>
              </div>
              <span class="calc__tag calc__tag--bonus">On top</span>
            </div>
          </div>

          <p class="calc__trade">
            <template v-if="projection">
              The only thing you give up is the {{ asset.yieldLabel }}:
              <strong>
                {{ formatAmount(projection.yieldRedirected, asset.displayDecimals) }} {{ asset.symbol }}
                ({{ formatUsd(projection.yieldRedirectedUsd) }}) a year.
              </strong>
              Your REFI is worth <strong class="calc__multiple">{{ formatMultiple(projection.multipleVsYield) }}</strong> that.
            </template>
            <template v-else>
              The only thing you give up is the {{ asset.yieldLabel }}.
            </template>
          </p>

          <div class="calc__ctas">
            <v-btn
              color="primary"
              size="large"
              class="calc__btn"
              @click="emit('stake', asset.symbol, amount)"
            >
              Stake {{ asset.symbol }}
            </v-btn>
            <v-btn
              variant="outlined"
              size="large"
              class="calc__btn calc__btn--ghost"
              :href="VENTURE_STAKING_TERMS_URL"
              target="_blank"
              rel="noopener"
            >
              Read the full terms
            </v-btn>
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
            <dt>Tier entered</dt>
            <dd>
              <template v-if="projection">
                {{ projection.tier.name }} ({{ projection.tier.baseMultiplier }}x),
                {{ formatUsdCompact(projection.existingUsd) }} deposited ahead of you
              </template>
              <template v-else>
                {{ DASH }}
              </template>
            </dd>
          </div>
          <div v-if="asset.symbol !== 'ETH'" class="calc__breakdown-row">
            <dt>Points weight, by yield</dt>
            <dd>{{ projection ? `${projection.yieldWeight.toFixed(2)}x a dollar of ETH` : DASH }}</dd>
          </div>
          <div class="calc__breakdown-row">
            <dt>Counts toward the tiers as</dt>
            <dd>{{ projection ? formatUsd(projection.amountUsd) : DASH }}</dd>
          </div>
          <div class="calc__breakdown-row">
            <dt>Month-1 share</dt>
            <dd>{{ projection ? formatShare(projection.monthOneShare) : DASH }}</dd>
          </div>
          <div class="calc__breakdown-row">
            <dt>REFI over 12 months</dt>
            <dd>{{ projection ? formatInt(projection.refi12) : DASH }}</dd>
          </div>
          <div class="calc__breakdown-row">
            <dt>Scenario price per REFI</dt>
            <dd>{{ formatPrice(pricePerRefi) }}</dd>
          </div>
          <p v-if="projection" class="calc__equation">
            {{ formatInt(projection.refi12) }} × {{ formatPrice(projection.pricePerRefi) }}
            = {{ formatUsd(projection.valueUsd) }}
          </p>
        </dl>
      </div>

      <p class="calc__fine">
        A projection at the chosen valuation at token launch, with the pool ({{ poolSentence }}) held flat.
        Points follow the yield a deposit contributes; REFI has no market price before TGE.
      </p>
    </div>
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

const props = defineProps<{
  /** USD deposited so far at deposit-time value; 0 before launch or when the read fails. */
  poolUsd: number;
  /** The pool's yield per dollar against ETH's (1 for an all-ETH pool). */
  poolYieldWeight?: number;
}>();

const emit = defineEmits<{ stake: [symbol: VentureAsset["symbol"], amount: number] }>();

const asset = ref<VentureAsset>(VENTURE_STAKING_ASSETS[0]);
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


const pricePerRefi = computed(() => (fdv.value * 1e6) / VENTURE_STAKING.supply);

const poolSentence = computed(() =>
  props.poolUsd > 0
    ? `${formatUsdCompact(props.poolUsd)} deposited so far`
    : `${formatUsdCompact(VENTURE_STAKING.assumedLaunchPoolUsd)} assumed at launch`,
);

const formatPrice = (value: number) => `$${value.toFixed(2)}`;

const formatShare = (share: number) =>
  `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;

const formatMultiple = (multiple: number) =>
  `${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}x`;

</script>

<style scoped lang="scss">
.calc {
  display: flex;
  flex-direction: column;






  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__inputs {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    padding: 1.875rem;
    border-right: 1px solid $color-line;

    @media (max-width: $screen-lg) {
      border-right: 0;
      border-bottom: 1px solid $color-line;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__label {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__step {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 400;
    color: $color-subtitle;
  }

  &__amount-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
  }

  &__amount {
    width: 11rem;
    max-width: 100%;
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

  &__assets {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.375rem;
    padding: 0.1875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__asset {
    padding: 0.3125rem 0.625rem;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: $text-xs;
    letter-spacing: 0.08em;
    color: $color-subtitle;
    transition: background $default-transition-time, color $default-transition-time;

    &:hover {
      color: $color-title;
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
    }

    &--active {
      background: var(--fill-2);
      color: $color-title;
    }
  }

  &__slider {
    width: 100%;
    height: 6px;
    min-height: 0;
    padding: 0;
    margin: 0.5rem 0 0;
    border-radius: 3px;
    background: linear-gradient(
      to right,
      $color-primary var(--fill),
      var(--fill-2) var(--fill)
    );
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

  &__fdv {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  &__fdv-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.875rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    color: $color-subtitle;
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
      color: $color-blue-bright;
    }
  }

  &__fdv-value {
    font-size: $text-sm;
  }

  &__fdv-label {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__result {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.875rem;
  }

  &__caption {
    font-family: $font-mono;
    font-size: $text-xs;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-subtitle;
  }










  &__ledger {
    display: flex;
    flex-direction: column;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__line {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 1rem;
    padding: 1.25rem;

    &--bonus {
      border-top: 1px solid $color-line;
      border-radius: 0 0 $default-border-radius $default-border-radius;
      background: $color-cyan-tint;
    }
  }

  &__line-icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-title;
  }

  &__line--bonus &__line-icon {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }

  &__line-body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__line-label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-subtitle;
  }

  &__line-value {
    font-family: $font-mono;
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
    color: $color-title;

    small {
      margin-left: 0.5rem;
      font-size: $text-sm;
      font-weight: 400;
      color: $color-subtitle;
    }
  }

  &__hero {
    font-family: $font-mono;
    font-size: clamp(2.25rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: $color-title;
  }

  &__line-note {
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__tag {
    padding: 0.1875rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-title;
    white-space: nowrap;

    &--bonus {
      border-color: $color-cyan-line;
      color: $color-cyan;
    }
  }

  // The "+" sits on the seam between what you keep and what you gain.
  &__plus {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    margin: -0.875rem 0 -0.875rem 1.6rem;
    border: 1px solid $color-cyan-line;
    border-radius: 50%;
    background: $color-surface;
    color: $color-cyan;
  }

  &__trade {
    margin: 0.25rem 0 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;

    strong {
      color: $color-title;
      font-weight: 600;
    }
  }

  &__multiple {
    font-family: $font-mono;
    color: $color-cyan !important;
  }

  &__ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  &__btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;

    &--ghost {
      border-color: $color-line-2;
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
    padding: 1rem 1.875rem;
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
    padding: 0 1.875rem 1.25rem;
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
    padding: 1.25rem 1.875rem 1.5rem;
    border-top: 1px solid $color-line;
    font-size: $text-xs;
    line-height: 1.6;
    color: $color-subtitle;
  }

  @media (max-width: $screen-sm) {
    &__inputs,
    &__result {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }


    &__toggle {
      padding: 1rem 1.25rem;
    }

    &__breakdown,
    &__fine {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }



    &__btn {
      flex: 1 1 100%;
    }

    &__line {
      grid-template-columns: auto minmax(0, 1fr);
      padding: 1rem;
    }

    // The labels already say it; the pill would squeeze the figures.
    &__tag {
      display: none;
    }

    &__plus {
      margin-left: 1.375rem;
    }
  }
}
</style>
