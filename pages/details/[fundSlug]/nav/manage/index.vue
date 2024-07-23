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
        <v-btn class="text-secondary" variant="outlined" @click="saveDraft">
          Save Draft
        </v-btn>
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

const {
  selectedFundSlug,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateEntries,
} = toRefs(useFundStore());

const toastStore = useToastStore();
const fundManagedNAVMethodsLocalStorage = ref({});

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
    toastStore.successToast("Draft saved successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save draft");
  }
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss"></style>
