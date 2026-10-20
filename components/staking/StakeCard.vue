<template>
  <section class="stake brand_card" aria-labelledby="stake-title">
    <div class="stake__head">
      <span id="stake-title" class="brand_card__eyebrow">Deposit</span>
      <button
        type="button"
        class="stake__calc"
        aria-label="Open the calculator"
        title="See what your stake could earn"
        @click="emit('calculate')"
      >
        <Icon icon="mdi:calculator-variant-outline" width="1.25rem" />
        Calculator
      </button>
    </div>

    <div class="stake__tokens" role="tablist" aria-label="Deposit token">
      <button
        v-for="option in tokens"
        :key="option"
        type="button"
        role="tab"
        class="stake__token"
        :class="{ 'stake__token--active': option === token }"
        :aria-selected="option === token"
        @click="token = option"
      >
        {{ option }}
      </button>
    </div>

    <label class="stake__deposit">
      <span class="stake__caption">You deposit</span>
      <span class="stake__deposit-row">
        <input
          ref="amountInput"
          v-model="amount"
          class="stake__amount"
          type="number"
          inputmode="decimal"
          min="0"
          step="any"
          placeholder="0.00"
          :aria-label="`Amount of ${token} to deposit`"
        >
        <span class="stake__symbol">{{ token }}</span>
      </span>
    </label>

    <dl class="stake__rows">
      <div class="stake__row">
        <dt>Your principal</dt>
        <dd>{{ principal }} {{ token }}</dd>
      </div>
      <div class="stake__row">
        <dt>Yield</dt>
        <dd>Reinvested</dd>
      </div>
      <div class="stake__row">
        <dt>You earn</dt>
        <dd class="stake__accent">
          {{ multiplier }}x points
        </dd>
      </div>
      <div class="stake__row">
        <dt>Withdraw</dt>
        <dd>Any settlement cycle</dd>
      </div>
    </dl>

    <v-btn
      class="stake__cta"
      color="primary"
      size="large"
      block
      @click="stake"
    >
      Stake {{ token }}
      <Icon icon="mdi:arrow-right" width="1.1rem" class="ms-2" />
    </v-btn>

    <p class="stake__note">
      Non-custodial. Your deposit sits in a Rethink vault on a Safe smart
      account and you hold the share token.
    </p>
  </section>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { VENTURE_STAKING_VAULT } from "~/composables/staking/ventureStakingConfig";

const tokens = ["ETH", "WBTC", "USDC"] as const;
type StakeToken = (typeof tokens)[number];

const token = ref<StakeToken>("ETH");
const amount = ref<string | number>("");
const amountInput = ref<HTMLInputElement>();
const toastStore = useToastStore();

defineProps<{
  /** The current tier's multiplier, which a deposit made now would earn. */
  multiplier: number;
}>();

const emit = defineEmits<{ calculate: [] }>();

const principal = computed(() => {
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) return "0.00";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
});

const stake = () => {
  // TODO: wire the deposit once the venture staking vault is deployed.
  if (!VENTURE_STAKING_VAULT.address) {
    toastStore.addToast("The venture staking vault is not deployed yet.", "info");
  }
};

/** The calculator's stake button hands its asset and amount over and focuses the field. */
const prefill = (symbol: StakeToken, value: number) => {
  token.value = symbol;
  amount.value = value;
  amountInput.value?.focus();
};

defineExpose({ prefill });
</script>

<style scoped lang="scss">
.stake {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__tokens {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__token {
    padding: 0.625rem 0;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: $text-sm;
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

  &__deposit {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1.125rem 1.25rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: var(--bg);
    cursor: text;
  }

  &__caption {
    font-family: $font-mono;
    font-size: $text-xs;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-subtitle;
  }

  &__deposit-row {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
  }

  &__amount {
    flex: 1;
    min-width: 0;
    // Out-states the global `:root input` height and padding.
    min-height: 0;
    height: auto;
    padding: 0;
    font-family: $font-mono;
    font-size: 2.25rem;
    line-height: 1.1;
    color: $color-title;
    outline: none;
    -moz-appearance: textfield;

    &::placeholder {
      color: $color-subtitle;
    }

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }

  &__symbol {
    font-family: $font-mono;
    font-size: $text-md;
    color: $color-subtitle;
    padding-bottom: 0.25rem;
  }

  &__rows {
    display: flex;
    flex-direction: column;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6875rem 0;
    border-top: 1px solid $color-line;
    font-size: $text-sm;

    &:last-child {
      border-bottom: 1px solid $color-line;
    }

    dt {
      color: $color-subtitle;
    }

    dd {
      font-family: $font-mono;
      color: $color-title;
      text-align: right;
    }
  }

  &__accent {
    color: $color-cyan !important;
  }

  &__cta {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__calc {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.75rem 0.4375rem 0.5rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-cyan;
    transition: border-color $default-transition-time;

    &:hover {
      border-color: $color-cyan;
    }

    &:focus-visible {
      outline: 2px solid $color-cyan;
      outline-offset: 2px;
    }
  }

  &__note {
    margin: 0;
    font-size: $text-xs;
    line-height: 1.5;
    text-align: center;
    color: $color-subtitle;
  }
}
</style>
