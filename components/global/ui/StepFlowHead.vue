<template>
  <!-- Label above, figure below: the eyebrow names the flow and carries the
       position in it, and the amount gets the weight because it is the thing
       being committed. The title slot of a multi-step UiConfirmDialog. -->
  <div class="step_flow_head">
    <div class="step_flow_head__eyebrow">
      {{ eyebrow }}
      <span class="step_flow_head__step">
        Step {{ step }} of {{ total }}
      </span>
    </div>
    <div v-if="amount" class="step_flow_head__amount">
      {{ amount }}
      <span class="step_flow_head__symbol">{{ symbol }}</span>
      <template v-if="toLabel">
        <span class="step_flow_head__arrow">→</span>
        <span class="step_flow_head__symbol">{{ toLabel }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string;
  step: number;
  total: number;
  amount?: string;
  symbol?: string;
  /** What the amount becomes or where it goes, after an arrow. */
  toLabel?: string;
}>();
</script>

<style lang="scss" scoped>
.step_flow_head {
  min-width: 0;

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

  &__amount {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: $color-white;
  }

  &__symbol {
    font-family: $font-mono;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: $color-text-irrelevant;
  }

  &__arrow {
    font-size: 13px;
    color: $color-steel-blue;
  }
}
</style>
