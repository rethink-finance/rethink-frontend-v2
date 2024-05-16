<template>
  <div class="nav">
    <div class="nav__header">
      MANAGE NAV methods section
    </div>
  </div>
</template>

<script setup lang="ts">
// import type IFund from "~/types/fund";

import { useFundStore } from "~/store/fund.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);

// const fund = useAttrs().fund as IFund;

const { selectedFundSlug } = toRefs(useFundStore());

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

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
.nav {

}
</style>
