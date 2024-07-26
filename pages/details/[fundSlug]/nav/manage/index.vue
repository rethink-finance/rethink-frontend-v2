<template>
  <div>
    <UiHeader>
      <div>
        <div class="main_header__title">Manage NAV Methods</div>
      </div>
      <div>
        <FundNavSimulateDialog />

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
            @click="saveDraft"
            :disabled="isSaveDraftDisabled"
          >
            Save Draft
          </v-btn>
        </div>
      </UiHeader>
      <FundNavMethodsTable v-model:methods="fundManagedNAVMethods" deletable />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const route = useRoute();

// fund address is always in the third position of the route
// e.g. /details/0xa4b1-TFD3-0x1234 -> 0x1234
const fundAddress = route.path.split("/")[2].split("-")[2];

const loadingDraftClear = ref(false);

const fundStore = useFundStore();
const {
  selectedFundSlug,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateEntries,
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

const getItemFromLocalStorage = (key: string) => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
};

const setItemInLocalStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getNAVMethodsFromLocalStorage = () => {
  let navUpdateEntries = getItemFromLocalStorage("navUpdateEntries");
  if (!navUpdateEntries) {
    navUpdateEntries = {};
  }

  return navUpdateEntries[selectedFundAddress.value] || {};
};

const clearDraft = async () => {
  try {
    loadingDraftClear.value = true;

    let navUpdateEntries = getItemFromLocalStorage("navUpdateEntries");
    if (!navUpdateEntries) {
      navUpdateEntries = {};
    }

    delete navUpdateEntries[selectedFundAddress.value];

    setItemInLocalStorage("navUpdateEntries", navUpdateEntries);
    fundManagedNAVMethodsLocalStorage.value = getNAVMethodsFromLocalStorage();

    // reset the fundManagedNAVMethods to fundLastNAVUpdateEntries
    fundStore.fundManagedNAVMethods = JSON.parse(
      JSON.stringify(fundLastNAVUpdateEntries.value)
    );

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
    let navUpdateEntries = getItemFromLocalStorage("navUpdateEntries");
    if (!navUpdateEntries) {
      navUpdateEntries = {};
    }

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value)
    );

    setItemInLocalStorage("navUpdateEntries", navUpdateEntries);
    fundManagedNAVMethodsLocalStorage.value = getNAVMethodsFromLocalStorage();

    toastStore.successToast("Draft saved successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save draft");
  }
};

const fundManagedNAVMethodsLocalStorage = ref(getNAVMethodsFromLocalStorage());

const isSaveDraftDisabled = computed(() => {
  const isSameAsLastUpdate =
    JSON.stringify(fundManagedNAVMethods.value) ===
    JSON.stringify(fundLastNAVUpdateEntries.value);

  const isSameAsLocalStorage =
    JSON.stringify(fundManagedNAVMethods.value) ===
    JSON.stringify(fundManagedNAVMethodsLocalStorage.value);

  return isSameAsLastUpdate || isSameAsLocalStorage;
});

const isClearDraftVisible = computed(() => {
  // check if the draft is empty
  const output =
    JSON.stringify(fundManagedNAVMethodsLocalStorage.value) !==
    JSON.stringify({});

  return output;
});

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
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
