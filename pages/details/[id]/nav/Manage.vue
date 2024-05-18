<template>
  <div>
    <UiHeader>
      <div>
        <div class="main_header__title">
          Manage NAV Methods
        </div>
      </div>
      <div>
        <v-btn
          class="text-secondary"
          variant="outlined"
        >
          Simulate NAV
        </v-btn>
        <v-btn class="bg-primary text-secondary ms-6">
          Create NAV Proposal
        </v-btn>
      </div>
    </UiHeader>
    <div class="main_card">
      <UiHeader>
        <div>
          <nuxt-link
            :to="`/details/${selectedFundSlug}/nav/newMethod`"
          >
            <v-btn
              class="text-secondary me-4"
              variant="outlined"
            >
              Define New Method
            </v-btn>
          </nuxt-link>
          <v-btn
            class="text-secondary"
            variant="outlined"
          >
            Add From Library
          </v-btn>
        </div>
        <!--        TODO implement saving/loading drafts to local storage -->
        <v-btn
          class="text-secondary"
          variant="outlined"
          disabled
        >
          Save Draft
        </v-btn>
      </UiHeader>
      <FundNavMethodsTable :methods="fundLastNAVUpdateEntries" deletable />
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

const { selectedFundSlug, fundLastNAVUpdateEntries } = toRefs(useFundStore());

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
