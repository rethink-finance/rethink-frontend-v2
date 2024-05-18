<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Define New Method
      </div>
    </UiHeader>
    <div class="main_card">
      <FundNavNewMethod />

    </div>
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";

import { useFundStore } from "~/store/fund.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);

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
    title: "Define New Method",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/newMethod`,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
.nav {

}
</style>
