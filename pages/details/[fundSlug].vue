<template>
  <div v-if="isLoadingFetchFundData" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="w-100">
    <FundSEOMetadata
      :fund-name="fund?.title"
      :symbol="fund?.fundToken?.symbol"
      :description="fund?.description"
      :image-url="fund?.photoUrl"
    />
    <FundHeader
      :fund="fund"
      :breadcrumb-items="breadcrumbItems"
    />
    <FundNavigation
      v-if="breadcrumbItems.length === 0"
      :routes="routes"
      :fund-details-route="fundDetailsRoute"
    />
    <UiBreadcrumbs
      v-if="breadcrumbItems.length > 0"
      :items="breadcrumbItems"
      class="breadcrumbs"
      :prepend-breadcrumb="prependBreadcrumb"
    />

    <NuxtPage :fund="fund" @update-breadcrumbs="setBreadcrumbItems" />
  </div>
  <div
    v-else-if="accountStore.isSwitchingNetworks"
    class="w-100 d-flex justify-center"
  >
    <v-progress-circular indeterminate />
  </div>
  <div v-else class="d-flex flex-column h-100 align-center">
    <h2 class="mb-2">
      Oops, there was a problem loading the vault
    </h2>
    <p class="text-center">
      Network error occurred. <br>
      Are you sure you are on the right network? <br>
      Try switching to a different network.
    </p>
  </div>
</template>

<script lang="ts" setup>
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import { ChainId } from "~/types/enums/chain_id";
import type IFund from "~/types/fund";
import type IRoute from "~/types/route";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import FundNavigation from "~/components/fund/Navigation.vue";
import FundHeader from "~/components/fund/FundHeader.vue";

const accountStore = useAccountStore();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const route = useRoute();
// fund address is always in the third position of the route
// e.g. /details/0xa4b1-TFD3-0x1234 -> 0x1234
const parts = route.path.split("/")[2]?.split("-") ?? [];

const fundChainId: ChainId = (parts[0] as ChainId);
const fundSymbol: string = parts[1] ?? "";
const fundAddress: string = parts[2] ?? "";

onMounted(() => {
  fetchFund();
  setBreadcrumbItems([]);
});

onUnmounted(() => {
  fundStore.selectedFundAddress = "";
  setBreadcrumbItems([]);
});

const fund = computed(() => fundStore.fund as IFund);

const breadcrumbItems = ref<BreadcrumbItem[]>([]);
const setBreadcrumbItems = (items: BreadcrumbItem[]) => {
  breadcrumbItems.value = items;
};

const fetchFund = async () => {
  if (!fundAddress || !fundChainId) {
    console.error("No fund address provided in the route.");
    return;
  }
  try {
    await fundStore.fetchFundData(fundChainId, fundAddress);
  } catch (e) {
    console.error("Failed fetching fund -> ", e);
  }
};

const isLoadingFetchFundData = computed(() =>
  actionStateStore.isActionState("fetchFundDataAction", ActionState.Loading),
);

watch(
  () => accountStore.connectedWallet,
  (wallet: any) => {
    fundStore.fetchUserFundData(fundChainId, fundAddress);
  },
);
// Watch for route changes to reset the breadcrumbs
watch(
  () => route.path,
  (newPath) => {
    const pathRoot = `${fundDetailsRoute.value}`;

    if (
      newPath === pathRoot ||
      newPath === `${pathRoot}/nav` ||
      newPath === `${pathRoot}/permissions` ||
      newPath === `${pathRoot}/flows` ||
      newPath === `${pathRoot}/governance`
    ) {
      setBreadcrumbItems([]);
    }
  },
);

const fundDetailsRoute = computed(
  () => `/details/${fundChainId}-${fundSymbol}-${fundAddress}`,
);

// show icon + title in the breadcrumb for the fund
const prependBreadcrumb = computed(() => {
  const output = {
    title: fund?.value?.fundToken?.symbol || "",
    to: fundDetailsRoute?.value || "",
    photoUrl: fund?.value?.photoUrl || "",
    disabled: false,
  } as BreadcrumbItem;

  return output;
});

const routes: IRoute[] = [
  {
    to: fundDetailsRoute.value,
    exactMatch: true,
    title: "Overview",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/governance`,
    exactMatch: false,
    matchPrefix: `${fundDetailsRoute.value}/governance`,
    title: "Governance",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/nav`,
    exactMatch: false,
    matchPrefix: `${fundDetailsRoute.value}/nav`,
    title: "NAV",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/permissions`,
    exactMatch: true,
    title: "Permissions",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/flows`,
    exactMatch: true,
    title: "Flows",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/execution-app`,
    exactMatch: true,
    title: "Execution App",
    text: "",
  },
];

</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
.breadcrumbs {
  margin-bottom: 2rem;
}
</style>
