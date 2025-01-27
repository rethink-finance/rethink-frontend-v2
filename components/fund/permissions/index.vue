<template>
  <div class="permissions">
    <div class="card_header">
      <div class="card_header__title subtitle_white">
        Permissions - Zodiac Roles
      </div>
    </div>
    <div class="permissions">
      insert roles here
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
const fundStore = useFundStore();
const fund = fundStore.fund;
</script>

<style lang="scss" scoped>
.permissions {

}
</style>
