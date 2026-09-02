<template>
  <div class="nav_new_method">
    <div class="nav_new_method__header">
      <h2 class="nav_new_method__title">
        Define new method
      </h2>
      <p class="nav_new_method__sub">
        Describe one position and how it is valued. The method is added to
        this vault's draft, to be stored with the next NAV proposal.
        <a
          class="nav_new_method__link"
          href="https://docs.rethink.finance/rethink.finance"
          target="_blank"
          rel="noopener noreferrer"
        >Learn more ↗</a>
      </p>
    </div>

    <div class="brand_card">
      <FundNavNewMethod
        :fund-address="fundStore.fund?.address"
        :base-token-address="fundStore.fund?.baseToken?.address"
        @new-nav-method-created="onNewNavMethodCreatedHandler"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

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
    title: "Define New Method",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage/newMethod`,
  },
];

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const onNewNavMethodCreatedHandler = (navMethod: INAVMethod) => {
  // Add newly defined NAV entry to fund managed methods.
  fundStore.fundManagedNAVMethods.push(navMethod);

  // Redirect back to Manage methods page.
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  toastStore.addToast("Method added successfully.")
}
</script>

<style scoped lang="scss">
.nav_new_method {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    color: $color-white;
  }

  &__sub {
    max-width: 72ch;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__link {
    margin-left: 0.25rem;
    color: $color-cyan;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }
}
</style>
