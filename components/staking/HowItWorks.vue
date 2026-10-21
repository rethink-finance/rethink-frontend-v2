<template>
  <ol class="how" aria-label="How staking works">
    <li class="how__step">
      <span class="how__top">
        <span class="how__icon" aria-hidden="true"><Icon icon="mdi:shield-lock-outline" width="1rem" /></span>
        <span class="how__num">01</span>
      </span>
      <span class="how__title">Deposit</span>
      <span class="how__text">Your principal stays yours.</span>
    </li>
    <li class="how__step">
      <span class="how__top">
        <span class="how__icon" aria-hidden="true"><Icon icon="mdi:sprout-outline" width="1rem" /></span>
        <span class="how__num">02</span>
      </span>
      <span class="how__title">Yield is reinvested</span>
      <span class="how__text">Into growing the Rethink ecosystem.</span>
    </li>
    <li class="how__step how__step--accent">
      <span class="how__top">
        <span class="how__icon" aria-hidden="true"><Icon icon="mdi:star-four-points-outline" width="1rem" /></span>
        <span class="how__num">03</span>
      </span>
      <span class="how__title">Earn <em>{{ multiplier }}x</em> points</span>
      <span class="how__text">Converted to <StakingRefiMark :size="14" /> REFI at TGE.</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  multiplier: number;
}>();
</script>

<style scoped lang="scss">
// Three cards with an arrow in each gap. The arrows are drawn by CSS, so the
// list holds exactly the three steps.
.how {
  --how-gap: 1.5rem;

  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--how-gap);
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: $screen-md) {
    --how-gap: 1.25rem;

    grid-template-columns: minmax(0, 1fr);
  }

  &__step {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.875rem 1rem 1rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-surface;
    box-shadow: var(--shadow-card);

    // The arrow sits in the middle of the gap before each step after the first.
    & + &::before {
      content: "\2192";
      position: absolute;
      top: 50%;
      left: calc(var(--how-gap) / -2);
      font-size: 0.9375rem;
      line-height: 1;
      color: $color-subtitle;
      opacity: 0.7;
      transform: translate(-50%, -50%);

      @media (max-width: $screen-md) {
        content: "\2193";
        top: calc(var(--how-gap) / -2);
        left: 50%;
      }
    }

    &--accent {
      border-color: $color-cyan-line;
      background:
        linear-gradient($color-cyan-tint, $color-cyan-tint),
        $color-surface;
    }
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid $color-line-2;
    border-radius: 7px;
    background: var(--fill-1);
    color: $color-title;
  }

  &__step--accent &__icon {
    border-color: $color-cyan-line;
    background: $color-cyan-tint;
    color: $color-cyan;
  }

  &__num {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
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
