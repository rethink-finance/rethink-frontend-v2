<template>
  <div v-if="period" class="settlement_cycle">
    <span class="settlement_cycle__label">Settlement</span>
    <!-- The cycle is an upper bound, not a fixed date — phrase it that way
         here, where it answers "when do I get my money?". Elsewhere the same
         value sits under a "Planned Settlement Cycle" label and reads bare. -->
    <span class="settlement_cycle__value">Within {{ period }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * The vault's planned settlement cycle, drawn as the last line of a deposit or
 * pending-request card — directly above whichever button acts on it.
 */
defineProps<{
  /** Parsed period, e.g. "2 weeks". Empty when the vault names none. */
  period?: string;
}>();
</script>

<style lang="scss" scoped>
.settlement_cycle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid $color-line;

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
  }
}
</style>
