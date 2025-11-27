<template>
  <div class="total-tvl-banner">
    <div class="total-tvl-content">
      <div class="total_tvl">
        <div class="total_tvl__label">
          TVL:
        </div>
        <div class="total_tvl__value">
          <v-progress-circular
            v-if="isLoadingTotalTVL"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            ${{ totalTVL?.totalTvlUSDFormatted }}
          </template>
        </div>
      </div>
      <div class="total-tvl-fund-count">
        <v-progress-circular
          v-if="isLoadingTotalTVL"
          class="d-flex"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          {{ totalTVL?.fundCount }} Vaults
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useFundsStore } from "~/store/funds/funds.store";
import { ActionState } from "~/types/enums/action_state";
import { useActionStateStore } from "~/store/actionState.store";

const actionStateStore = useActionStateStore();
const fundsStore = useFundsStore();
const { totalTVL } = storeToRefs(fundsStore);

const isLoadingTotalTVL =
  computed(() => actionStateStore.isActionState("fetchTotalTVLAction", ActionState.Loading));
</script>

<style lang="scss" scoped>
.total-tvl-banner {
  width: 100%;
  background-color: $color-surface;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  border: 1px solid $color-border-dark;
}

.total-tvl-content {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.total_tvl {
  align-items: center;
  justify-content: center;
  flex-direction: row;
  display: flex;
  gap: 0.825rem;

  &__label {
    font-size: $text-lg;
    color: var(--v-on-surface-variant);
  }
  &__value {
    font-size: $text-lg;
    font-weight: 600;
    color: var(--v-on-surface);
  }
}
.total-tvl-fund-count {
  color: var(--v-on-surface-variant);
  margin-left: 8px;
}
</style>
