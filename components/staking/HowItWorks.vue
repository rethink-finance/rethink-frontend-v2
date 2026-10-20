<template>
  <ol class="how" aria-label="How staking works">
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:shield-lock-outline" width="1.375rem" /></span>
      <span class="how__title">You deposit</span>
      <span class="how__text">ETH, WBTC or USDC. Your principal stays preserved.</span>
    </li>
    <li class="how__arrow" aria-hidden="true">
      <Icon icon="mdi:arrow-right" width="1.25rem" />
    </li>
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:sprout-outline" width="1.375rem" /></span>
      <span class="how__title">The yield is reinvested</span>
      <span class="how__text">Into growing the Rethink Finance ecosystem.</span>
    </li>
    <li class="how__arrow" aria-hidden="true">
      <Icon icon="mdi:arrow-right" width="1.25rem" />
    </li>
    <li class="how__step how__step--accent">
      <span class="how__icon"><Icon icon="mdi:star-four-points-outline" width="1.375rem" /></span>
      <span class="how__title">You earn points</span>
      <span class="how__text">
        <strong>{{ multiplier }}x</strong> right now in the {{ tierName }} tier.
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  multiplier: number;
  tierName: string;
}>();
</script>

<style scoped lang="scss">
.how {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: $screen-md) {
    grid-template-columns: minmax(0, 1fr);
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1.25rem 1.375rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-surface;
    box-shadow: var(--shadow-card);

    &--accent {
      border-color: $color-cyan-line;
      background:
        linear-gradient($color-cyan-tint, $color-cyan-tint),
        $color-surface;
    }
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    margin-bottom: 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-title;
  }

  &__step--accent &__icon {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }

  &__title {
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__text {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;

    strong {
      font-family: $font-mono;
      color: $color-cyan;
    }
  }

  &__arrow {
    display: grid;
    place-items: center;
    color: $color-subtitle;

    @media (max-width: $screen-md) {
      transform: rotate(90deg);
      padding: 0;
      height: 1.25rem;
    }
  }
}
</style>
