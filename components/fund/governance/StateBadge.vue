<template>
  <span class="state_badge" :class="`state_badge--${tone}`">
    {{ value }}
  </span>
</template>

<script setup lang="ts">
import { ProposalState } from "~/types/enums/governance_proposal";

/**
 * A proposal's state, or one of the calldata tags beside it.
 *
 * Toned by outcome rather than by category: a proposal that is still being
 * decided is the only one worth an accent, so Active carries it and the tags —
 * which describe what a proposal does, not how it went — stay neutral.
 */
const props = defineProps<{
  value?: string;
  /** Tags are always neutral, whatever they happen to be named. */
  neutral?: boolean;
}>();

const POSITIVE = [ProposalState.Executed, ProposalState.Succeeded] as string[];
const NEGATIVE = [ProposalState.Defeated, ProposalState.Canceled] as string[];

const tone = computed(() => {
  if (props.neutral) return "neutral";
  const value = props.value ?? "";
  if (value === ProposalState.Active) return "accent";
  if (POSITIVE.includes(value)) return "positive";
  if (NEGATIVE.includes(value)) return "negative";
  return "neutral";
});
</script>

<style lang="scss" scoped>
.state_badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.4375rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-family: $font-mono;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
  color: $color-steel-blue;

  &--accent {
    color: $color-cyan;
    border-color: $color-accent-line;
    background: $color-accent-soft;
  }

  &--positive {
    color: $color-success-light;
    border-color: $color-yield-line;
    background: $color-yield-soft;
  }

  &--negative {
    color: $color-error;
    border-color: rgba(230, 106, 96, 0.32);
    background: rgba(230, 106, 96, 0.1);
  }
}
</style>
