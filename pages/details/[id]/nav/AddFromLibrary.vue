<template>
  <div class="add_from_library">
    <UiHeader>
      <div class="main_header__title">
        Add From Library
      </div>
      <div>
        <v-btn
          class="bg-primary text-secondary"
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
        :methods="allNavMethods"
        selectable
        @selected-changed="onSelectionChanged"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
// import {
//   PositionType,
// } from "~/types/enums/position_type";
// import { ValuationType } from "~/types/enums/valuation_type";
// import type INAVMethod from "~/types/nav_method";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { useFundsStore } from "~/store/funds.store";
import type INAVMethod from "~/types/nav_method";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const fundsStore = useFundsStore();
const toastStore = useToastStore();
const router = useRouter();

const loadingAllNavMethods = ref(false);
const selectedMethods = ref<INAVMethod[]>([]);

const { selectedFundSlug } = toRefs(fundStore);
const { allNavMethods } = toRefs(fundsStore);

// watch(() => method.value.valuationType, () => {
//   // Reset method details when valuationType change
//   method.value.details = [{}];
// });

// const fund = useAttrs().fund as IFund;
// console.log(fund);

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
    to: `/details/${selectedFundSlug.value}/nav/addFromLibrary`,
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

const onSelectionChanged = (data: INAVMethod[]) => {
  selectedMethods.value = data;
}
const addMethods = () => {
  // // Add newly defined method to fund managed methods.
  // TODO prevent selecting duplicates, pass already selected methods to the table and mark them as "in use".
  for (const method of selectedMethods.value) {
    fundStore.fundManagedNAVMethods.push(method);
  }

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Methods added successfully.")
}
</script>

<style scoped lang="scss">
</style>
