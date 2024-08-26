<template>
  <div v-if="fund" class="deposit_redeem_notification">
    <div>
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
  padding: 1rem;
  gap: 1.5rem;
  font-size: $text-sm;
  color: $color-light-subtitle;
  background: $color-gray-light-transparent;
  @include sm {
    @include borderGray();
    margin: 1.5rem 0;
  }
}
</style>
