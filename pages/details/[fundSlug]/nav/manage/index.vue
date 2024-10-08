<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Manage NAV Methods
      </div>
      <div>
        
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/newMethod`">
          <v-btn class="text-secondary me-4" variant="outlined">
            Define New Method
          </v-btn>
        </nuxt-link>
        <nuxt-link
          :to="`/details/${selectedFundSlug}/nav/manage/addFromLibrary`"
        >
          <v-btn class="text-secondary me-4" variant="outlined">
            Add From Library
          </v-btn>
        </nuxt-link>

        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/proposal`">
          <v-btn class="bg-primary text-secondary">
            Create NAV Proposal
          </v-btn>
        </nuxt-link>
      </div>
    </UiHeader>
    <div class="main_card">
      <UiHeader>
        <div class="subtitle_steel_blue mb-0">
          {{ changesNumber }} Changes
        </div>
        <div class="btn-draft">
          <v-btn
            v-if="isClearDraftVisible"
            class="text-secondary"
            variant="outlined"
            @click="clearDraft"
          >
            Clear Draft
          </v-btn>
        </div>
      </UiHeader>
      <FundNavMethodsTable
        v-model:methods="fundManagedNAVMethods"
        deletable
        show-summary-row
        show-base-token-balances
        show-simulated-nav
        idx="nav/manage/index"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);


const {
  selectedFundSlug,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateMethods,
} = toRefs(useFundStore());

const toastStore = useToastStore();

const changesNumber = computed(() => {
  // check how many methods are deleted and added
  const changedMethods = Object.values(fundManagedNAVMethods.value).filter(
    (method) => {
      return method.deleted || method.isNew;
    }
  )

  return changedMethods.length;
});

const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Manage NAV Methods",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage`,
  },
];


const clearDraft = () => {
  try {
    fundManagedNAVMethods.value =  JSON.parse(JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt), parseBigInt);
    // reset the local storage as well
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});
    // navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    // we need to delete navUpdateEntries[selectedFundAddress.value];
    delete navUpdateEntries[selectedFundAddress.value];

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear NAV draft");
  }
};

const saveDraft = () => {
  try {
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt),
    );

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save NAV draft");
  }
};

const isClearDraftVisible = computed(() => {
  // check if the draft is the same as the last update
  const isSameAsLastUpdate =
    JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt) ===
    JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt);
  const isDraftEmpty = Object.keys(fundManagedNAVMethods.value).length === 0;

  return !isSameAsLastUpdate && !isDraftEmpty;
});

// watch for changes in fundManagedNAVMethods
// and update the local storage
watch(
  fundManagedNAVMethods,
  () => {
    saveDraft();
  },
  { deep: true },
);

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">
.btn-draft {
  min-height: 40px;
}
</style>
