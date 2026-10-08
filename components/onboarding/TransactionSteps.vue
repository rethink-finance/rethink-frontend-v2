<template>
  <div class="tx_steps">
    <!-- One segment per transaction, filling as they land. -->
    <div class="tx_steps__bar">
      <span
        v-for="(step, index) in steps"
        :key="`seg-${index}`"
        class="tx_steps__segment"
        :class="{
          'tx_steps__segment--done': step.state === 'done',
          'tx_steps__segment--current': isLive(step),
          'tx_steps__segment--failed': step.state === 'failed',
        }"
      />
    </div>

    <div
      v-for="(step, index) in steps"
      :key="index"
      class="tx_steps__step"
      :class="`tx_steps__step--${step.state}`"
    >
      <div class="tx_steps__row">
        <span class="tx_steps__marker">
          <v-progress-circular
            v-if="isLive(step)"
            size="13"
            width="2"
            indeterminate
          />
          <Icon
            v-else-if="step.state === 'done'"
            icon="material-symbols:check"
            height="0.875rem"
            width="0.875rem"
          />
          <Icon
            v-else-if="step.state === 'failed'"
            icon="material-symbols:close-rounded"
            height="0.875rem"
            width="0.875rem"
          />
          <template v-else>
            {{ index + 1 }}
          </template>
        </span>
        <span class="tx_steps__label">{{ step.label }}</span>
        <span class="tx_steps__state">{{ STATE_WORDS[step.state] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A sequence of wallet transactions as a rail, the way the deposit dialog
 * draws its own: done above, the live one in front of you, the rest waiting.
 * Each row carries a word for where its transaction is, so the dialog answers
 * "what is my wallet about to ask, and what has already gone through?"
 * without a button that pretends to send everything at once.
 */
export type TransactionStepState =
  /** Not reached yet. */
  | "waiting"
  /** The wallet is open, asking for a signature. */
  | "wallet"
  /** Signed and sent; waiting for the chain. */
  | "confirming"
  | "done"
  | "failed";

export interface ITransactionStep {
  label: string;
  state: TransactionStepState;
}

defineProps<{
  steps: ITransactionStep[];
}>();

const STATE_WORDS: Record<TransactionStepState, string> = {
  // Left off the steps further down: their dimming already says it.
  waiting: "",
  wallet: "Confirm in wallet",
  confirming: "Confirming",
  done: "Done",
  failed: "Failed",
};

const isLive = (step: ITransactionStep) =>
  step.state === "wallet" || step.state === "confirming";
</script>

<style scoped lang="scss">
.tx_steps {
  &__bar {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
  }

  &__segment {
    flex: 1 1 0;
    height: 3px;
    border-radius: 999px;
    background: $color-line-2;
    transition: background-color $default-transition-time ease;

    &--done {
      background: $color-cyan-raw;
    }

    &--current {
      background: $color-accent-line;
    }

    &--failed {
      background: $color-neg;
    }
  }

  &__step {
    position: relative;

    &:not(:last-child) {
      padding-bottom: 0.875rem;

      /* Joins the markers rather than running the height of the row, so the
         rail reads as one line threaded through them. */
      &::after {
        content: "";
        position: absolute;
        left: 0.75rem;
        top: 1.625rem;
        bottom: 0.1875rem;
        width: 1px;
        margin-left: -0.5px;
        background: $color-line-2;
      }
    }

    &--done {
      &:not(:last-child)::after {
        background: $color-accent-line;
      }

      .tx_steps__marker {
        color: $color-cyan;
        border-color: $color-accent-line;
        background: $color-accent-soft;
      }

      .tx_steps__label {
        color: $color-text-irrelevant;
      }

      .tx_steps__state {
        color: $color-cyan;
      }
    }

    &--wallet,
    &--confirming {
      .tx_steps__marker {
        color: $color-cyan;
        border-color: $color-cyan;
        /* A flat ring, not a blur: it lifts the live step off the rail. */
        box-shadow: 0 0 0 4px $color-accent-soft;
      }

      .tx_steps__label {
        color: $color-white;
        font-weight: 600;
      }

      .tx_steps__state {
        color: $color-cyan;
      }
    }

    &--failed {
      .tx_steps__marker,
      .tx_steps__state {
        color: $color-neg;
      }

      .tx_steps__marker {
        border-color: $color-neg;
      }

      .tx_steps__label {
        color: $color-white;
        font-weight: 600;
      }
    }

    /* Not reached yet. */
    &--waiting {
      opacity: 0.5;
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__marker {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1;
    color: $color-steel-blue;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease,
      box-shadow $default-transition-time ease;
  }

  &__label {
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  /* Pushed to the right edge so the words line up in a column of their own. */
  &__state {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    &__segment,
    &__marker {
      transition: none;
    }
  }
}
</style>
