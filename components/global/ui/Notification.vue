<template>
  <div v-if="fund" class="deposit_redeem_notification">
    <div class="d-flex">
      <Icon
        icon="zondicons:exclamation-outline"
        width="1.5rem"
        color="var(--color-primary)"
      />
    </div>

    <p>
      <slot />
    </p>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";

const { fund } = toRefs(useFundStore());
</script>

<style lang="scss" scoped>
.deposit_redeem_notification {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 26px;
  font-size: $text-sm;
  color: $color-white;
  background: $color-card-background;
  @include sm {
    @include borderGray();
    margin: 1.5rem 0;
  }
}
</style>
