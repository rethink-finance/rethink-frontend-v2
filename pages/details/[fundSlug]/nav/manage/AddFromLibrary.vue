<template>
  <div class="add_from_library">
    <UiHeader>
      <div class="main_header__title">Add From Library</div>
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

    <UiHeader>
      <div class="main_header__title">
        <v-text-field
          v-model="search"
          label="Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
          class="search"
        />
      </div>
      <div class="subtitle_steel_blue mb-0">
        {{ selectedMethodHashes.length }} selected
      </div>
    </UiHeader>

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
      :search="search"
      show-simulated-nav
      idx="addFromLibrary"
      @selected-changed="onSelectionChanged"
    />
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

import { useFundsStore } from "~/store/funds/funds.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const fundsStore = useFundsStore();
const toastStore = useToastStore();
const router = useRouter();

const loadingAllNavMethods = ref(false);
const selectedMethodHashes = ref<string[]>([]);
const search = ref("");

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
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(
      fundStore.fundChainId,
    );
    // Fetch all possible NAV methods for all funds
    await fundsStore.fetchFundsNAVData(fundStore.fundChainId, fundsInfoArrays);
    loadingAllNavMethods.value = false;
  }
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const onSelectionChanged = (hashes: string[]) => {
  selectedMethodHashes.value = hashes;
};

const addMethods = () => {
  // // Add newly defined method to fund managed methods.
  const methods = uniqueNavMethods.value.filter((method) =>
    selectedMethodHashes.value.includes(method.detailsHash || ""),
  );

  for (const method of methods) {
    method.isNew = true;
    fundStore.fundManagedNAVMethods.push(method);
  }

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Methods added successfully.");
};
</script>

<style scoped lang="scss">
.search {
  width: 300px;
}
</style>
