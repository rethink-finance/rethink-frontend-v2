<template>
  <!-- A multi-transaction flow as a rail: done above, current in front of
       you, the rest waiting. The same rail the deposit flow draws, as a
       component, so other flows with several wallet confirmations (the
       test-funds return) look and read the same. ProcessDepositModal still
       carries its own copy of this markup and can move onto this one. -->
  <div class="step_flow">
    <div class="step_flow__bar">
      <span
        v-for="(step, index) in steps"
        :key="`seg-${index}`"
        class="step_flow__segment"
        :class="{
          'step_flow__segment--done': step.done,
          'step_flow__segment--current': index === currentIndex,
        }"
      />
    </div>

    <div
      v-for="(step, index) in steps"
      :key="index"
      class="step_flow__step"
      :class="{
        'step_flow__step--done': step.done,
        'step_flow__step--current': index === currentIndex,
        'step_flow__step--blocked': step.isDisabled,
      }"
    >
      <v-tooltip
        :disabled="!step.isDisabled || !step.tooltip"
        location="top"
      >
        <template #default>
          {{ step.tooltip }}
        </template>
        <template #activator="{ props: activator }">
          <div v-bind="activator" class="step_flow__row">
            <span class="step_flow__marker">
              <v-progress-circular
                v-if="step.loading"
                size="13"
                width="2"
                indeterminate
              />
              <Icon
                v-else-if="step.done"
                icon="material-symbols:check"
                height="0.875rem"
                width="0.875rem"
              />
              <template v-else>{{ index + 1 }}</template>
            </span>
            <span class="step_flow__label">{{ step.label }}</span>
            <span class="step_flow__state">{{ stepState(step, index) }}</span>
          </div>
        </template>
      </v-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface IStepFlowStep {
  label: string;
  done: boolean;
  loading?: boolean;
  /** Reachable, but not yet; `tooltip` says why. */
  isDisabled?: boolean;
  tooltip?: string;
}

const props = defineProps<{
  steps: IStepFlowStep[];
}>();

/**
 * Where the user is: the first step still outstanding. The steps are strictly
 * sequential, so anything before it is finished and anything after it has
 * not been reached.
 */
const currentIndex = computed(() => props.steps.findIndex((step) => !step.done));

/**
 * A word per row, so the rail says what each step is doing and not only where
 * it sits. "Waiting" is left off the steps further down — rows all saying the
 * same thing is noise, and their dimming already says it.
 */
const stepState = (step: IStepFlowStep, index: number) => {
  if (step.loading) return "Signing";
  if (step.done) return "Done";
  if (step.isDisabled) return "Locked";
  return index === currentIndex.value ? "Now" : "";
};
</script>

<style lang="scss" scoped>
.step_flow {
  margin-bottom: 1.75rem;

  /**
   * One segment per transaction, filling as they land. The rail below says
   * which step is which; this says how much of the flow is left, which is the
   * question being asked before the wallet opens.
   */
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
      /* Matches the specificity of the base connector rule above, which is
         written with :not(:last-child) and would otherwise win. */
      &:not(:last-child)::after {
        background: $color-accent-line;
      }

      .step_flow__marker {
        color: $color-cyan;
        border-color: $color-accent-line;
        background: $color-accent-soft;
      }

      .step_flow__label {
        color: $color-text-irrelevant;
      }

      .step_flow__state {
        color: $color-cyan;
      }
    }

    &--current {
      .step_flow__marker {
        color: $color-cyan;
        border-color: $color-cyan;
        /* A flat ring, not a blur: it lifts the live step off the rail without
           putting a shadow into a design that has one. */
        box-shadow: 0 0 0 4px $color-accent-soft;
      }

      .step_flow__label {
        color: $color-white;
        font-weight: 600;
      }

      .step_flow__state {
        color: $color-cyan;
      }
    }

    /* Reachable, but not yet — the tooltip on the row says why. */
    &--blocked {
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
  }
}
</style>
