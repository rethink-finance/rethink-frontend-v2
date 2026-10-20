<template>
  <ol class="how" aria-label="How staking works">
    <li class="how__step">
      <span class="how__icon" aria-hidden="true"><Icon icon="mdi:shield-lock-outline" width="1.125rem" /></span>
      <span class="how__body">
        <span class="how__num">01</span>
        <span class="how__title">Deposit</span>
        <span class="how__text">ETH, WBTC or USDC. Your principal stays yours.</span>
      </span>
    </li>
    <li class="how__step">
      <span class="how__icon" aria-hidden="true"><Icon icon="mdi:sprout-outline" width="1.125rem" /></span>
      <span class="how__body">
        <span class="how__num">02</span>
        <span class="how__title">Yield is reinvested</span>
        <span class="how__text">Into growing the Rethink ecosystem.</span>
      </span>
    </li>
    <li class="how__step how__step--accent">
      <span class="how__icon" aria-hidden="true"><Icon icon="mdi:star-four-points-outline" width="1.125rem" /></span>
      <span class="how__body">
        <span class="how__num">03</span>
        <span class="how__title">Earn <em>{{ multiplier }}x</em> points</span>
        <span class="how__text">Converted to <StakingRefiMark :size="14" /> REFI at TGE.</span>
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  multiplier: number;
}>();
</script>

<style scoped lang="scss">
// Three steps in one strip. The arrows between them are drawn by CSS, so
// the list holds exactly the three steps.
.how {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-surface;
  list-style: none;

  @media (max-width: $screen-md) {
    grid-template-columns: minmax(0, 1fr);
  }

  &__step {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    min-width: 0;
    padding: 1rem 1.375rem 1rem 1.5rem;

    & + & {
      border-left: 1px solid $color-line-2;

      // The arrow sits on the seam between two steps.
      &::before {
        content: "\2192";
        position: absolute;
        top: 50%;
        left: 0;
        display: grid;
        place-items: center;
        width: 1.375rem;
        height: 1.375rem;
        border: 1px solid $color-line-2;
        border-radius: 50%;
        background: $color-surface;
        font-size: 0.75rem;
        line-height: 1;
        color: $color-subtitle;
        transform: translate(-50%, -50%);
      }

      @media (max-width: $screen-md) {
        border-left: 0;
        border-top: 1px solid $color-line-2;

        // Centred on the seam, clear of the step icons on the left.
        &::before {
          top: 0;
          left: 50%;
          content: "\2193";
          transform: translate(-50%, -50%);
        }
      }
    }

    &--accent {
      border-radius: 0 $default-border-radius $default-border-radius 0;
      background: $color-cyan-tint;

      @media (max-width: $screen-md) {
        border-radius: 0 0 $default-border-radius $default-border-radius;
      }
    }
  }

  &__icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid $color-line-2;
    border-radius: 50%;
    background: var(--bg);
    color: $color-subtitle;
  }

  &__step--accent &__icon {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__num {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
  }

  &__step--accent &__num {
    color: $color-cyan;
  }

  &__title {
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;

    em {
      font-family: $font-mono;
      font-style: normal;
      color: $color-cyan;
    }
  }

  &__text {
    font-size: $text-sm;
    line-height: 1.45;
    color: $color-subtitle;
  }
}
</style>
