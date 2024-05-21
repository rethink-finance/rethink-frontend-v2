<template>
  <div class="add_from_library">
    <UiHeader>
      <div class="main_header__title">
        Add From Library
      </div>
      <div>
        <v-btn class="bg-primary text-secondary">
          Add Methods
        </v-btn>
      </div>
    </UiHeader>

    <div class="main_card">
      <v-container>
        <v-row>
          <v-col>
            <strong>Popular Methods</strong>
          </v-col>
        </v-row>
        <v-row>
          <FundNavMethodsTable :methods="fundManagedNAVMethods" selectable />
        </v-row>
      </v-container>
    </div>
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";
// import {
//   PositionType,
// } from "~/types/enums/position_type";
// import { ValuationType } from "~/types/enums/valuation_type";
// import type INAVMethod from "~/types/nav_method";
// import { useRouter } from "vue-router";
// import { useToastStore } from "~/store/toast.store";
// import { formatJson } from "~/composables/utils";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
// const fundStore = useFundStore();
// const toastStore = useToastStore();
// const router = useRouter();


// TODO replace fundManagedNAVMethods with fetced methods from fetchAllNavMethods
const { fundManagedNAVMethods } = toRefs(useFundStore());

// const method = ref<INAVMethod>({
//   positionName: "",
//   valuationSource: "",
//   positionType: PositionType.Liquid,
//   valuationType: ValuationType.DEXPair,
//   details: [
//     {},
//   ],
//   detailsJson: "",
// });

// watch(() => method.value.valuationType, () => {
//   // Reset method details when valuationType change
//   method.value.details = [{}];
// });

// const fund = useAttrs().fund as IFund;
// console.log(fund);

const { selectedFundSlug } = toRefs(useFundStore());

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

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
</style>
