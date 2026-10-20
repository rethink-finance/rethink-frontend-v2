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
              <span class="calc__step">02</span> FDV at TGE
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
          <span class="calc__caption">Your REFI after the first year would be worth</span>
          <div class="calc__hero">
            {{ projection ? formatUsd(projection.valueUsd) : DASH }}
          </div>
          <p class="calc__subline">
            <template v-if="projection">
              You enter the <strong>{{ projection.tier.name }} tier at {{ projection.tier.baseMultiplier }}x</strong>.
              In the ${{ fdv }}M scenario that is
              <strong>{{ formatMultiple(projection.multipleVsYield) }}</strong>
              the {{ asset.yieldLabel }} you give up.
            </template>
            <template v-else>
              Enter how much {{ asset.symbol }} you would stake.
            </template>
          </p>

          <div class="calc__stats">
            <div class="calc__stat">
              <span class="calc__stat-value">
                {{ projection ? `${formatCompact(projection.refi12)} REFI` : DASH }}
              </span>
              <span class="calc__stat-label">REFI you earn</span>
            </div>
            <span class="calc__multiple">
              {{ projection ? formatMultiple(projection.multipleVsYield) : DASH }}
            </span>
            <div class="calc__stat">
              <span class="calc__stat-value">
                <template v-if="projection">
                  {{ formatAmount(projection.yieldRedirected, asset.displayDecimals) }} {{ asset.symbol }}
                  · {{ formatUsd(projection.yieldRedirectedUsd) }}
                </template>
                <template v-else>
                  {{ DASH }}
                </template>
              </span>
              <span class="calc__stat-label">{{ asset.yieldLabel }} you redirect in a year</span>
            </div>
          </div>

          <p class="calc__reassure">
            <span class="calc__dot" aria-hidden="true" />
            <span>
              <strong>Your {{ asset.symbol }} never leaves your control.</strong>
              It sits in a non-custodial vault you can exit at any time; only the yield moves.
            </span>
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
                {{ formatInt(projection.existingEth) }} ETH ahead of you
              </template>
              <template v-else>
                {{ DASH }}
              </template>
            </dd>
          </div>
          <div v-if="asset.symbol !== 'ETH'" class="calc__breakdown-row">
            <dt>Counts toward the pool as</dt>
            <dd>{{ projection ? `${formatAmount(projection.ethEquivalent)} ETH` : DASH }}</dd>
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
        A projection, not a promise. Pool size: {{ poolSentence }}, held there for 12 months with no
        new deposits. ETH at {{ formatUsd(VENTURE_STAKING.ethPriceUsd) }} with a
        {{ formatRate(VENTURE_STAKING.stakingYield) }} staking yield.
        <template v-if="asset.symbol !== 'ETH'">
          {{ asset.symbol }} at {{ formatUsd(asset.priceUsd) }} with a {{ formatRate(asset.yieldRate) }} yield,
          counted toward the ETH tiers at that value.
        </template>
        Emissions start near {{ formatInt(monthOneEmission()) }} REFI a month and decay
        {{ formatRate(VENTURE_STAKING.monthlyDecay) }} monthly over {{ VENTURE_STAKING.emissionMonths }} months.
        Tier bonuses halve after month 12 and end after month 36. REFI has no market price before TGE;
        the FDV scenarios are illustrations.
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
  formatRate,
  formatUsd,
} from "~/composables/staking/formatStaking";
import {
  monthOneEmission,
  projectVentureStake,
} from "~/composables/staking/ventureStaking";
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  VENTURE_STAKING_TERMS_URL,
  type VentureAsset,
} from "~/composables/staking/ventureStakingConfig";

const props = defineProps<{
  /** ETH (at ETH value) in the pool now; 0 before launch or when the read fails. */
  poolEth: number;
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
    livePoolEth: props.poolEth,
    fdvMillions: fdv.value,
  }),
);


const pricePerRefi = computed(() => (fdv.value * 1e6) / VENTURE_STAKING.supply);

const poolSentence = computed(() =>
  props.poolEth > 0
    ? `${formatInt(props.poolEth)} ETH staked so far`
    : `${formatInt(VENTURE_STAKING.assumedLaunchPoolEth)} ETH assumed at launch`,
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

  &__hero {
    font-family: $font-mono;
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: $color-title;
  }

  &__subline {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: var(--text-dim);

    strong {
      color: $color-title;
    }
  }

  &__stats {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
    padding: 1rem 1.25rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__stat-value {
    font-family: $font-mono;
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__stat-label {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__multiple {
    font-family: $font-mono;
    font-size: 1.25rem;
    font-weight: 600;
    color: $color-subtitle;
  }

  &__reassure {
    display: flex;
    gap: 0.625rem;
    margin: 0.25rem 0 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;

    strong {
      color: $color-title;
      font-weight: 600;
    }
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-top: 0.5rem;
    border-radius: 50%;
    background: $color-cyan-raw;
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

    &__stats {
      grid-template-columns: 1fr;
    }

    &__multiple {
      order: -1;
    }

    &__btn {
      flex: 1 1 100%;
    }
  }
}
</style>
