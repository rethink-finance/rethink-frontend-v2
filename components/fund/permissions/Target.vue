<template>
  <div class="permissions__target">
    {{ truncateAddress(target?.address) }}
  </div>
</template>

<script setup lang="ts">
import type { Target } from "~/types/zodiac-roles/role";
import { truncateAddress } from "~/composables/addressUtils";

const props = defineProps({
  target: {
    type: Object as PropType<Target>,
    default: () => {},
  },
});
</script>

<style lang="scss" scoped>
.permissions {
  &__target {
    display: flex;
    padding: 1rem;
  }
}
</style>
