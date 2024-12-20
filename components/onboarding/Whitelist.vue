<template>
  <section
    class="onboarding-whitelist"
  >
    <div
      class="toggleable_group__toggle"
    >
      <v-switch
        v-model="isWhitelistedDeposits"
        color="primary"
        hide-details
      />
    </div>

    <SectionWhitelist
      v-if="isWhitelistedDeposits"
      :items="whitelist"
      @update-items="handleWhitelistChange"
    />
    <div v-else>
      <UiInfoBox
        class="info-box"
        info="Whitelist is disabled. This means that anyone can deposit into the OIV. <br>
                      If you want to enable the whitelist, please toggle the switch above. <br>
                      Whitelist is a list of addresses that are allowed to deposit into the OIV."
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import SectionWhitelist from "~/pages/details/[fundSlug]/governance/fund-settings/SectionWhitelist.vue";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

const emit = defineEmits(["update-items", "update-is-whitelisted-deposits"]);

// 0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3
// 0x0000000000000000000000000000000000000000

const props = defineProps<{
  lsIsWhitelistedDeposits: boolean;
  lsWhitelist: IWhitelist[];
}>();

// Data
const isWhitelistedDeposits = ref(false)
const whitelist = ref<IWhitelist[]>([]);
// Computeds

// Methods
const handleWhitelistChange = (items: IWhitelist[]) => {
  whitelist.value = items;
  emit("update-items", whitelist.value);
};

// Watchers
watch(isWhitelistedDeposits, () => {
  emit("update-is-whitelisted-deposits", isWhitelistedDeposits.value);
});

// Lifecycle Hooks
onMounted(() => {
  isWhitelistedDeposits.value = props.lsIsWhitelistedDeposits ?? false;
  whitelist.value = props.lsWhitelist ?? [];

  emit("update-is-whitelisted-deposits", isWhitelistedDeposits.value);
  emit("update-items", whitelist.value);
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
