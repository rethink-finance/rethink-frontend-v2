<template>
  <ol class="how" aria-label="How staking works">
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:shield-lock-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Deposit</strong> ETH, WBTC or USDC. Principal stays yours.
      </span>
    </li>
    <li class="how__arrow" aria-hidden="true">
      <Icon icon="mdi:arrow-right" width="1rem" />
    </li>
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:sprout-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Yield is reinvested</strong> in the Rethink ecosystem.
      </span>
    </li>
    <li class="how__arrow" aria-hidden="true">
      <Icon icon="mdi:arrow-right" width="1rem" />
    </li>
    <li class="how__step how__step--accent">
      <span class="how__icon"><Icon icon="mdi:star-four-points-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Earn points:</strong> <em>{{ multiplier }}x</em> right now, converted to
        <StakingRefiMark :size="15" /> REFI at TGE.
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
.how {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: $screen-md) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  &__step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  &__icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid $color-line-2;
    border-radius: 50%;
    background: var(--bg);
    color: $color-subtitle;
  }

  &__step--accent &__icon {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }

  &__text {
    font-size: $text-sm;
    line-height: 1.45;
    color: $color-subtitle;

    strong {
      font-weight: 600;
      color: $color-title;
    }

    em {
      font-family: $font-mono;
      font-style: normal;
      font-weight: 600;
      color: $color-cyan;
    }
  }

  &__arrow {
    display: grid;
    place-items: center;
    color: $color-subtitle;

    @media (max-width: $screen-md) {
      display: none;
    }
  }
}
</style>
