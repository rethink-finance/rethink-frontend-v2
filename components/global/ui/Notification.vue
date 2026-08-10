<template>
  <div v-if="fund" class="brand_note brand_note--info deposit_redeem_notification">
    <Icon
      icon="material-symbols:info-outline"
      class="brand_note__icon"
    />

    <p class="brand_note__body brand_note__text">
      <slot />
    </p>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";

const { fund } = storeToRefs(useFundStore());
</script>

<style lang="scss" scoped>
/* Panel treatment comes from the shared .brand_note; only the spacing this
   notice takes inside the settlement forms is local. */
.deposit_redeem_notification {
  p {
    margin: 0;
  }

  @include sm {
    margin: 1.5rem 0;
  }
}
</style>
