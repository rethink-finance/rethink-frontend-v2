<template>
  <div class="overview">
    <UiDataRowCard title="Vault Settings" class="data_row_card">
      <template #body>
        <FundOverviewSettings :fund="fund" />
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});
</script>

<style lang="scss" scoped>
.overview {
  margin-bottom: 2.5rem;

  @include sm {
    margin-bottom: 1rem;
  }
}
.data_row_card {
  :deep(.v-expansion-panel-title) {
    padding: 1.5rem;
    font-size: 1rem;
  }

  :deep(.v-expansion-panel-text__wrapper) {
    padding: 0;
  }
}
</style>
