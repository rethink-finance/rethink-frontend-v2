<template>
  <section
    class="onboarding_whitelist"
  >
    <div
      v-if="!isInitialized"
      class="toggleable_group__toggle"
    >
      <v-switch
        v-model="isWhitelistEnabled"
        color="primary"
        hide-details
      />
    </div>

    <SectionWhitelist
      v-model="whitelist"
      v-model:whitelist-enabled="isWhitelistEnabled"
      :is-preview="isInitialized"
    />
  </section>
</template>

<script setup lang="ts">
import SectionWhitelist from "~/pages/details/[fundSlug]/governance/fund-settings/SectionWhitelist.vue";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

const emit = defineEmits(["update:modelValue", "update:whitelistEnabled"]);

const props = defineProps({
  modelValue: {
    type: Array as () => IWhitelist[],
    default: () => [],
  },
  whitelistEnabled: {
    type: Boolean,
    default: false,
  },
  isInitialized: {
    type: Boolean,
    default: false,
  },
});

const whitelist = computed({
  get: () => props?.modelValue || [],
  set: (value: Record<string, any>) => {
    emit("update:modelValue", value);
  },
});
const isWhitelistEnabled = computed({
  get: () => props.whitelistEnabled || false,
  set: (value: boolean) => {
    emit("update:whitelistEnabled", value);
  },
});
</script>

<style scoped lang="scss">
.toggleable_group {
  display: flex;
  flex-direction: column;

  &__toggle {
    display: flex;
    justify-content: flex-end;
    margin-left: auto;
  }
}
</style>
