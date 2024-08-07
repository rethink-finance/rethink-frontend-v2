<template>
  <div>
    <UiHeader>
      <div>
        <div class="main_header__title">
          Manage NAV Methods
        </div>
      </div>
      <div>
        <FundNavSimulateButton 
          @simulateNAV="handleSimulateNav" 
        />

        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/proposal`">
          <v-btn class="bg-primary text-secondary ms-6">
            Create NAV Proposal
          </v-btn>
        </nuxt-link>
      </div>
    </UiHeader>
    <div class="main_card">
      <UiHeader>
        <div>
          <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/newMethod`">
            <v-btn class="text-secondary me-4" variant="outlined">
              Define New Method
            </v-btn>
          </nuxt-link>
          <nuxt-link
            :to="`/details/${selectedFundSlug}/nav/manage/addFromLibrary`"
          >
            <v-btn class="text-secondary" variant="outlined">
              Add From Library
            </v-btn>
          </nuxt-link>
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
          <v-btn
            class="text-secondary"
            variant="outlined"
            :disabled="isSaveDraftDisabled"
            @click="saveDraft"
          >
            Save Draft
          </v-btn>
        </div>
      </UiHeader>
      <FundNavMethodsTable
        v-model:methods="fundManagedNAVMethods"
        deletable
        show-summary-row
        show-base-token-balances
        show-simulated-nav
        :trigger-simulate-nav="triggerSimulateNav"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);

const loadingDraftClear = ref(false);
const triggerSimulateNav = ref(0);

const {
  selectedFundSlug,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateMethods,
} = toRefs(useFundStore());

const toastStore = useToastStore();

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

// watcher for methods length to trigger simulate nav
watch(() => fundManagedNAVMethods.value.length, () => {
  console.log("triggered by methods length");
  handleSimulateNav();
});

const handleSimulateNav = () => {
  triggerSimulateNav.value++;
};

const clearDraft = () => {
  loadingDraftClear.value = true;
  try {
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});

    // reset the fundManagedNAVMethods to fundLastNAVUpdateMethods
    fundManagedNAVMethods.value = JSON.parse(
      JSON.stringify(fundLastNAVUpdateMethods.value),
    );
    navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    setLocalStorageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear draft");
  } finally {
    loadingDraftClear.value = false;
  }
};

const saveDraft = () => {
  try {
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value),
    );

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);
    fundManagedNAVMethods.value = navUpdateEntries[selectedFundAddress.value];
    console.log("LS: ", navUpdateEntries)
    toastStore.successToast("Draft saved successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save draft");
  }
};

const isSaveDraftDisabled = computed(() => {
  return false;
  const isSameAsLastUpdate =
    JSON.stringify(fundManagedNAVMethods.value) ===
    JSON.stringify(fundLastNAVUpdateMethods.value);

  // const isSameAsLocalStorage =
  //   JSON.stringify(fundManagedNAVMethods.value) ===
  //   JSON.stringify(fundManagedNAVMethods.value);

  return isSameAsLastUpdate ;
  // return isSameAsLastUpdate || isSameAsLocalStorage;
});

const isClearDraftVisible = computed(() => {
  return true;
  // check if the draft is empty
  const output =
    JSON.stringify(fundManagedNAVMethods.value) !==
    JSON.stringify({});

  return output;
});

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
  handleSimulateNav(); // trigger simulate NAV on mount
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">
.btn-draft {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
}
</style>
