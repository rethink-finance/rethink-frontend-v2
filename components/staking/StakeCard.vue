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

    <StakingAssetTabs v-model="token" />

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

  </section>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { VENTURE_STAKING_VAULT, type VentureAsset } from "~/composables/staking/ventureStakingConfig";

type StakeToken = VentureAsset["symbol"];

/** The selected asset; the page highlights it in every section. */
const token = defineModel<StakeToken>("token", { required: true });
const amount = ref<string | number>("");
const amountInput = ref<HTMLInputElement>();
const toastStore = useToastStore();

defineProps<{
  /** The current tier's multiplier, which a deposit made now would earn. */
  multiplier: number;
}>();

const emit = defineEmits<{ calculate: [] }>();


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
  gap: 0.875rem;



  &__deposit {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.875rem 1.125rem;
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

}
</style>
