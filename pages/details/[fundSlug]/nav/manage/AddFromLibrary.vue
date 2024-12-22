<template>
  <FundNavAddFromLibrary
    :methods="uniqueNavMethods"
    :used-methods="fundStore.fundManagedNAVMethods"
    :loading-all-nav-methods="loadingAllNavMethods"
    @add-methods="addMethods"
  />
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

import { useFundsStore } from "~/store/funds/funds.store";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const fundsStore = useFundsStore();
const toastStore = useToastStore();
const router = useRouter();

// Data
const loadingAllNavMethods = ref(false);
const { selectedFundSlug } = toRefs(fundStore);
const { allNavMethods } = toRefs(fundsStore);
const { uniqueNavMethods } = toRefs(fundsStore);

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

// Methods
const addMethods = (methods: INAVMethod[]) => {
  // // Add newly defined method to fund managed methods.
  for (const method of methods) {
    method.isNew = true;
    fundStore.fundManagedNAVMethods.push(method);
  }

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Methods added successfully.");
};

// Lifecycle Hooks
onMounted(async () => {
  emit("updateBreadcrumbs", breadcrumbItems);

  if (!allNavMethods.value.length) {
    loadingAllNavMethods.value = true;
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(
      fundStore.fundChainId,
    );
    // Fetch all possible NAV methods for all funds
    try {
      await fundsStore.fetchFundsNavMethods(fundStore.fundChainId, fundsInfoArrays);
    } catch (e: any) {
      console.error("Failed fetchFundsNavMethods", e)
    }
    loadingAllNavMethods.value = false;
  }
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">
</style>
