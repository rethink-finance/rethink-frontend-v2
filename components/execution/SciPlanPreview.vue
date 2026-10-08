<template>
  <div v-if="plan && (plan.problem || plan.parts.length)" class="sci_plan">
    <div v-if="plan.problem" class="sci_plan__idle">
      {{ plan.problem }}
    </div>
    <template v-else>
      <div class="sci_plan__chain">
        <span class="sci_plan__label">{{ plan.parts.length > 1 ? "One transaction" : "This transaction" }}</span>
        <span v-for="(part, index) in plan.parts" :key="index" class="sci_plan__step">
          <span v-if="index > 0" class="sci_plan__arrow">→</span>
          <span class="sci_plan__part">
            <span class="sci_plan__n">{{ index + 1 }}</span>
            {{ sentence(part) }}
          </span>
        </span>
      </div>
      <div v-if="plan.warning" class="sci_plan__warning">
        {{ plan.warning }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SciPlan } from "~/composables/execution/sciEthConsole";

/**
 * What one press will do, call by call, in the order the calls run. A plan
 * that cannot go out shows its reason instead, in a quiet tone: most of the
 * time that is a state ("there are no rewards to claim"), not an error.
 */
defineProps<{ plan: SciPlan | null }>();

const sentence = (part: string) => part.charAt(0).toUpperCase() + part.slice(1);
</script>

<style scoped lang="scss">
.sci_plan {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__label {
    margin-right: 0.25rem;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__step {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__part {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0.5rem 0.1875rem 0.25rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-size: 12px;
    color: $color-light-subtitle;
    white-space: nowrap;
  }

  &__n {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: $color-cyan-tint;
    font-family: $font-mono;
    font-size: 9.5px;
    color: $color-cyan;
  }

  &__arrow {
    font-size: 11px;
    color: $color-text-irrelevant;
  }

  &__idle {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__warning {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-warn;
  }
}
</style>
