<template>
  <div class="total-tvl-banner">
    <div class="total-tvl-content">
      <div class="total-tvl-label">
        TVL:
      </div>
      <div class="total-tvl-value">
        ${{ totalTVL?.totalTvlUSDFormatted }}
      </div>
      <div class="total-tvl-fund-count">
        {{ totalTVL?.fundCount }} Vaults
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useFundsStore } from "~/store/funds/funds.store";

const fundsStore = useFundsStore();
const { totalTVL } = storeToRefs(fundsStore);
</script>

<style lang="scss" scoped>
.total-tvl-banner {
  width: 100%;
  background-color: var(--v-surface-variant);
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.total-tvl-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-tvl-label {
  font-size: 16px;
  color: var(--v-on-surface-variant);
}

.total-tvl-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--v-on-surface);
}

.total-tvl-fund-count {
  font-size: 14px;
  color: var(--v-on-surface-variant);
  margin-left: 8px;
}
</style>
