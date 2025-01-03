<template>
  <div class="onboarding_finalize">
    <p>
      After finalizing the setup users will be able to deposit into your OIV.
    </p>
    <p>
      Please note that any future change after finalization will go through governance.
    </p>

    <v-btn
      color="primary"
      @click="finalizeFundCreation"
    >
      Finalize
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

const emit = defineEmits(["update:modelValue"]);

const props = defineProps({
  modelValue: {
    type: Array as () => IWhitelist[],
    default: () => [],
  },
});

const finalizeFundCreation = () => {
  console.warn("finalizeFundCreation");
};
</script>

<style scoped lang="scss">
.onboarding_finalize {
  padding-block: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
</style>
