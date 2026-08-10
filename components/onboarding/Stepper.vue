<template>
  <div class="onb_stepper">
    <div class="onb_stepper__track">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="onb_stepper__cell"
        :class="{
          'onb_stepper__cell--current': index + 1 === current,
          'onb_stepper__cell--complete': index + 1 !== current && index + 1 <= maxReached,
          'onb_stepper__cell--future': index + 1 > maxReached,
        }"
        :disabled="index + 1 > maxReached"
        :title="titleFor(index)"
        @click="emit('select', index + 1)"
      >
        <span class="onb_stepper__badge">
          <Icon
            v-if="index + 1 !== current && index + 1 <= maxReached"
            icon="material-symbols:check-rounded"
            width="0.875rem"
            height="0.875rem"
          />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="onb_stepper__name">{{ step.name }}</span>
        <IconChain
          v-if="step.key === OnboardingStep.Basics && chainId"
          :chain-id="chainId"
          :size="16"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChainId } from "~/types/enums/chain_id";
import { OnboardingStep, type IOnboardingStep } from "~/types/enums/stepper_onboarding";

/**
 * The step rail. Only steps already reached are clickable — a step further on
 * has nothing to show yet, and a rail that lets you land there and find an
 * empty form reads as broken rather than as free navigation.
 */
const props = defineProps({
  steps: {
    type: Array as PropType<IOnboardingStep[]>,
    default: () => [],
  },
  /** 1-based. */
  current: {
    type: Number,
    default: 1,
  },
  /** The furthest step reached so far; everything up to it stays clickable. */
  maxReached: {
    type: Number,
    default: 1,
  },
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
});

const emit = defineEmits(["select"]);

const titleFor = (index: number) => {
  if (index + 1 === props.current) return props.steps[index]?.name ?? "";
  if (index + 1 <= props.maxReached) return `Go to ${props.steps[index]?.name}`;
  return "Finish the steps before this one first";
};
</script>

<style scoped lang="scss">
.onb_stepper {
  padding: 0.875rem 1rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-surface;
  overflow-x: auto;

  &__track {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* Seven cells only fit side by side above this; below it the rail scrolls
       rather than stacking, so the sequence stays readable as a sequence. */
    min-width: 900px;
  }

  &__cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    padding: 0.375rem 0.5rem;
    border: none;
    border-radius: $default-border-radius;
    background: transparent;
    text-align: left;
    cursor: pointer;

    &--future {
      opacity: 0.55;
      cursor: default;
    }
  }

  &__badge {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 26px;
    height: 26px;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    color: $color-steel-blue;
  }

  &__name {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__cell--current &__badge {
    border-color: $color-cyan;
    background: $color-cyan-tint;
    color: $color-cyan;
  }
  &__cell--current &__name {
    font-weight: 600;
    color: $color-white;
  }

  &__cell--complete &__badge {
    color: $color-white;
  }
  &__cell--complete &__name {
    color: $color-text-irrelevant;
  }
}
</style>
