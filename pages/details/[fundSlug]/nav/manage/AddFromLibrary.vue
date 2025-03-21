<template>
  <FundNavAddFromLibrary
    :chain-id="fundStore.selectedFundChain"
    :fund-address="fundStore.fundAddress"
    :safe-address="fundStore.fund?.safeAddress || ''"
    :base-symbol="fundStore.fund?.baseToken?.symbol || ''"
    :base-decimals="fundStore.fund?.baseToken?.decimals || 18"
    :already-used-methods="fundStore.fundManagedNAVMethods"
    @methods-added="methodsAddedFromLibrary"
  />
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

// Data
const { selectedFundSlug } = storeToRefs(fundStore);

const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Manage NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav/manage`,
  },
  {
    title: "Add From Library",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage/addFromLibrary`,
  },
];

// Lifecycle Hooks
onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});

onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});


// Methods
const methodsAddedFromLibrary = (addedMethods: INAVMethod[]) => {
  // // Add newly defined method to fund managed methods.
  for (const method of addedMethods) {
    method.isNew = true;
    fundStore.fundManagedNAVMethods.push(method);
  }

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Methods added successfully.");
};
</script>

<style scoped lang="scss">
</style>
