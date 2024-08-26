<template>
  <div class="add_from_library">
    <UiHeader>
      <div class="main_header__title">
        Add From Library
      </div>
      <div>
        <v-btn
          class="bg-primary text-secondary"
          :disabled="!selectedMethodHashes.length"
          @click="addMethods"
        >
          Add Methods
        </v-btn>
      </div>
    </UiHeader>

    <div class="main_card">
      <div>
        <strong>Popular Methods</strong>
      </div>
      <div v-if="loadingAllNavMethods" class="mt-4">
        <v-skeleton-loader type="table-row" />
        <v-skeleton-loader type="table-row" />
        <v-skeleton-loader type="table-row" />
        <v-skeleton-loader type="table-row" />
      </div>
      <FundNavMethodsTable
        v-else
        :methods="uniqueNavMethods"
        :used-methods="fundStore.fundManagedNAVMethods"
        selectable
        show-simulated-nav
        idx="addFromLibrary"
        @selected-changed="onSelectionChanged"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { useFundsStore } from "~/store/funds.store";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const fundsStore = useFundsStore();
const toastStore = useToastStore();
const router = useRouter();

const loadingAllNavMethods = ref(false);
const selectedMethodHashes = ref<string[]>([]);

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

onMounted(async () => {
  emit("updateBreadcrumbs", breadcrumbItems);

  if (!allNavMethods.value.length) {
    loadingAllNavMethods.value = true;
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays()
    const fundAddresses: string[] = fundsInfoArrays[0];
    // Fetch all possible NAV methods for all funds
    await fundsStore.fetchAllNavMethods(fundAddresses);
    loadingAllNavMethods.value = false;
  }
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const onSelectionChanged = (hashes: string[]) => {
  selectedMethodHashes.value = hashes;
}

const addMethods = () => {
  // // Add newly defined method to fund managed methods.
  const methods = uniqueNavMethods.value.filter(method => selectedMethodHashes.value.includes(method.detailsHash || ""));

  for (const method of methods) {
    method.isNew = true;
    fundStore.fundManagedNAVMethods.push(method);
  }

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Methods added successfully.")
}
</script>

<style scoped lang="scss">
</style>
