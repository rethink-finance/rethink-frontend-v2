<template>
  <div v-if="fund" class="deposit_redeem_notification">
    <div>
      <Icon icon="zondicons:exclamation-outline" width="1.5rem" color="var(--color-primary)" />
    </div>

    <p>
      The deposit and redeem requests are settled within the planned Settlement Cycle
      of <span class="text-primary">{{ fund.plannedSettlementPeriod }}</span>.
      You can learn more about how settlements work
      <a href="https://docs.rethink.finance/rethink.finance" target="_blank">here</a>.
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
