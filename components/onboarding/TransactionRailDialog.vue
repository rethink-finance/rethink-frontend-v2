<template>
  <!--
    A run of wallet steps (useTransactionRail), drawn the way the NAV methods
    dialog draws its own: the rail, then one line for what happens now. It
    cannot be closed while a step is live — the wallet may still be asking.
  -->
  <UiConfirmDialog
    :model-value="modelValue"
    max-width="480px"
    :persistent="isRunning"
    @update:model-value="close"
  >
    <template #title>
      <div class="tx_rail__eyebrow">
        {{ eyebrow }}
        <span class="tx_rail__step">
          Step {{ stepNumber }} of {{ steps.length }}
        </span>
      </div>
      <h2 class="brand_modal__title tx_rail__title">
        {{ title }}
      </h2>
    </template>

    <p v-if="intro" class="tx_rail__intro">
      {{ intro }}
    </p>

    <OnboardingTransactionSteps :steps="steps" />

    <div class="tx_rail__foot">
      <template v-if="isDone">
        <div class="tx_rail__done">
          <Icon
            icon="material-symbols:check"
            class="tx_rail__done_icon"
            height="1rem"
            width="1rem"
          />
          <span>{{ doneText }}</span>
        </div>
        <v-btn class="tx_rail__button bg-primary text-secondary" @click="close(false)">
          Close
        </v-btn>
      </template>
      <template v-else-if="error">
        <p class="tx_rail__error">
          {{ error }}
        </p>
        <v-btn class="tx_rail__button bg-primary text-secondary" @click="emit('retry')">
          Try again
        </v-btn>
      </template>
      <p v-else class="tx_rail__note">
        {{ note }}
      </p>
    </div>
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import type { ITransactionStep } from "~/components/onboarding/TransactionSteps.vue";

const props = defineProps<{
  modelValue: boolean;
  eyebrow: string;
  title: string;
  /** Why the rail has the steps it has, when that needs saying. */
  intro?: string;
  steps: ITransactionStep[];
  stepNumber: number;
  isRunning: boolean;
  isDone: boolean;
  error: string;
  note: string;
  doneText: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [open: boolean];
  retry: [];
}>();

const close = (open: boolean) => {
  // The wallet may still be asking: the rail stays up until it has an answer.
  if (open || props.isRunning) return;
  emit("update:modelValue", false);
};
</script>

<style scoped lang="scss">
.tx_rail {
  &__eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__step {
    padding: 0.0625rem 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: $color-text-irrelevant;
  }

  &__title {
    margin-top: 0.375rem;
  }

  &__intro {
    margin-bottom: 1.5rem;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__foot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin-top: 1.75rem;
  }

  &__note {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__error {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-neg;
    word-break: break-word;
  }

  &__button {
    width: 100%;
    min-height: 2.75rem;
    font-weight: 600;
  }

  /* The outcome, in the accent the finished steps above it are using. */
  &__done {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-light-subtitle;
  }

  &__done_icon {
    flex: none;
    margin-top: 0.125rem;
    color: $color-cyan;
  }
}
</style>
