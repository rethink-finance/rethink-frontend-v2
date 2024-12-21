<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Define New Methods

        <UiTooltipClick
          location="right"
          :hide-after="6000"
        >
          <Icon
            icon="material-symbols:info-outline"
            class="info-icon"
            width="1.5rem"
          />

          <template #tooltip>
            <div class="tooltip__content">
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon
                  icon="maki:arrow"
                  color="primary"
                  width="1rem"
                />
              </a>
            </div>
          </template>
        </UiTooltipClick>
      </div>
    </UiHeader>

    <FundNavNewMethod
      :fund-address="fundStore.fund?.address"
      :base-token-address="fundStore.fund?.baseToken?.address"
      @new-nav-method-created="onNewNavMethodCreatedHandler"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import type INAVMethod from "~/types/nav_method";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const { selectedFundSlug } = toRefs(fundStore);

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
.main_header {
  min-height: 40px;

  &__title {
    display: flex;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
}
.tooltip{
  &__content{
    display: flex;
    gap: 40px;
  }
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}

.info-icon {
  cursor: pointer;
  display: flex;
  color: $color-text-irrelevant;
}
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
:deep(.v-expansion-panel-title) {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.method_details_title {
  display: flex;
  align-items: center;
  gap: 1rem;
  letter-spacing: 0.02625rem;
  font-weight: 500;
  color: $color-text-irrelevant;
}
.method_details_status {
  color: $color-warning;

  &--valid {
    color: $color-success;
  }
}
// toggle buttons
.toggle_buttons {
  .v-btn-toggle {
    display: flex;
    gap: 10px;

    .v-btn {
      opacity: 0.35;
      color: $color-text-irrelevant;
      border-radius: 4px !important;
      @include borderGray;
    }
    .v-btn--active {
      color: $color-white !important;
      opacity: 1;
    }
  }
}
</style>
