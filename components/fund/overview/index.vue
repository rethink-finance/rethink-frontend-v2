<template>
  <div class="overview brand_card">
    <UiDataRowCard class="data_row_card">
      <template #title>
        <span class="overview__eyebrow">Vault settings</span>
      </template>
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
/**
 * The design breaks this content into separate flat panels (governance, fees,
 * contracts). It stays one accordion here so nothing on the page changes
 * behaviour, but the chrome is the design's: brand card outside, a mono
 * uppercase eyebrow for the trigger, mono label/value pairs inside.
 */
.overview {
  padding: 0;

  /* Rendered through the title slot, so it is styled directly rather than
     through :deep — which would also catch the value rows nested below. */
  &__eyebrow {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  .data_row_card {
    :deep(.v-expansion-panel) {
      background: transparent;
    }

    :deep(.v-expansion-panel-title) {
      height: auto;
      padding: 1.375rem 1.875rem;
    }

    :deep(.v-expansion-panel-text__wrapper) {
      padding: 0 1.875rem 1.5rem;
    }

    /* Inside every row the subtitle is the caption and the title is the
       figure — the design sets both in mono, the caption in small caps. */
    :deep(.data_row__subtitle) {
      font-family: $font-mono;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }

    :deep(.v-expansion-panel-text .data_row__title) {
      font-family: $font-mono;
      font-size: 12.5px;
      font-weight: 500;
      color: $color-white;
    }

    /* Flatten the nested rows: the design separates values with a hairline
       rather than stacking a filled box inside an already-filled card. */
    :deep(.v-expansion-panel-text .data_row__panel) {
      background: transparent;
      border-bottom: 1px solid $color-line;
    }

    /* Nested only — matching on ".v-expansion-panel-text …" would also catch
       the outer wrapper, which is an ancestor of every nested one. */
    :deep(.v-expansion-panel-text__wrapper .v-expansion-panel-title) {
      padding: 0.75rem 0;
    }

    :deep(.v-expansion-panel-text__wrapper .v-expansion-panel-text__wrapper) {
      padding: 0 0 0.75rem;
    }
  }
}
</style>
