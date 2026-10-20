<template>
  <ol class="how" aria-label="How staking works">
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:shield-lock-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Deposit</strong> ETH, WBTC or USDC. Principal stays yours.
      </span>
    </li>
    <li class="how__step">
      <span class="how__icon"><Icon icon="mdi:sprout-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Yield is reinvested</strong> in the Rethink ecosystem.
      </span>
    </li>
    <li class="how__step how__step--accent">
      <span class="how__icon"><Icon icon="mdi:star-four-points-outline" width="1rem" /></span>
      <span class="how__text">
        <strong>Earn points:</strong> <em>{{ multiplier }}x</em> right now, converted to REFI at TGE,
        100% vested.
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;

  // A thin rail joins the three steps.
  &::before {
    content: "";
    position: absolute;
    top: 1rem;
    bottom: 1rem;
    left: calc(1rem - 0.5px);
    width: 1px;
    background: $color-line-2;
  }

  &__step {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.875rem;
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
}
</style>
