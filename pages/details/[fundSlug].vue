<template>
  <!-- .page_shell, not .w-100: Vuetify's utility is !important and would beat
       the shared page width cap. -->
  <!-- Skeletons only while there is nothing to show: a vault opened before is
       served from cache at once and refreshed behind the page. -->
  <div v-if="isLoadingFetchFundData && !fund?.address" class="page_shell">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="page_shell">
    <FundSEOMetadata
      :fund-name="fund?.title"
      :symbol="fund?.fundToken?.symbol"
      :description="fund?.description"
      :image-url="fund?.photoUrl"
    />
    <div class="fund_topbar">
      <NuxtLink to="/" class="fund_topbar__back">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        All vaults
      </NuxtLink>
      <FundNavigation
        v-if="breadcrumbItems.length === 0"
        class="fund_topbar__nav"
        :routes="routes"
        :fund-details-route="fundDetailsRoute"
      />
    </div>
    <!-- Identity, page body and the deposit rail share one grid so the rail can
         start level with the vault title and stay pinned while the long left
         column scrolls. The rail belongs to the overview only; every other
         section runs the full width. -->
    <div class="fund_layout" :class="{ 'fund_layout--split': isOverviewRoute }">
      <FundHeader
        class="fund_layout__header"
        :fund="fund"
        :breadcrumb-items="breadcrumbItems"
        :section-title="sectionTitle"
        :overview-route="fundDetailsRoute"
      />
      <UiBreadcrumbs
        v-if="breadcrumbItems.length > 0"
        :items="breadcrumbItems"
        class="fund_layout__header breadcrumbs"
        :prepend-breadcrumb="prependBreadcrumb"
      />

      <aside v-if="isOverviewRoute" class="fund_layout__rail">
        <FundCurrentCycle
          v-if="userDepositRequestExists || userRedemptionRequestExists"
          :fund="fund"
        />
        <FundSettlement
          v-else
          :fund="fund"
          :should-user-delegate="shouldUserDelegate"
        />

        <FundInfoMyDeposits v-if="isConnected" :fund="fund" />
      </aside>

      <div class="fund_layout__body">
        <NuxtPage :fund="fund" @update-breadcrumbs="setBreadcrumbItems" />
      </div>
    </div>
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

// State for the deposit rail, which the shell renders so it can sit alongside
// the vault identity rather than below it.
const {
  shouldUserDelegate,
  userDepositRequestExists,
  userRedemptionRequestExists,
} = storeToRefs(fundStore);
const { isConnected } = storeToRefs(accountStore);
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
  () => {
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
      newPath === `${pathRoot}/whitelist` ||
      newPath === `${pathRoot}/profile` ||
      newPath === `${pathRoot}/governance`
    ) {
      setBreadcrumbItems([]);
    }
  },
);

const fundDetailsRoute = computed(
  () => `/details/${fundChainId}-${fundSymbol}-${fundAddress}`,
);

const isOverviewRoute = computed(() => route.path === fundDetailsRoute.value);

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

// Overview is not among these: the header's "back to overview" button is how
// you leave a section, so listing it here as well would give the same
// destination two controls a few pixels apart.
const routes: IRoute[] = [
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
    to: `${fundDetailsRoute.value}/whitelist`,
    exactMatch: true,
    title: "Whitelist",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/profile`,
    exactMatch: true,
    title: "Vault Profile",
    text: "",
  },
  {
    to: `${fundDetailsRoute.value}/execution-app`,
    exactMatch: true,
    title: "Execution App",
    text: "",
  },
];

/**
 * The section currently open, read off the same list the curator row is built
 * from so renaming a tab renames the heading with it. Deeper pages inside a
 * section still name the section, not themselves.
 */
const sectionTitle = computed(() => {
  if (isOverviewRoute.value) return "";
  const match = routes.find(
    (routeItem) =>
      route.path === routeItem.to || route.path.startsWith(`${routeItem.to}/`),
  );
  return match?.title ?? "";
});

</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
.breadcrumbs {
  margin-bottom: 2rem;
}

/**
 * Overview layout: identity in the top-left, the vault's own content beneath
 * it, and the deposit rail occupying the full right column from the title
 * down. Spanning both rows is what lets the rail stay sticky for the whole
 * scroll of the left column. Below desktop it is a plain stack, with the rail
 * right after the identity so depositing is never buried under the page.
 */
.fund_layout {
  &--split {
    @include xl {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 380px;
      column-gap: 1.375rem;
      align-items: start;
    }
  }

  &__header {
    @include xl {
      grid-column: 1;
      grid-row: 1;
    }
  }

  &__body {
    min-width: 0;

    @include xl {
      grid-column: 1;
      grid-row: 2;
    }
  }

  &__rail {
    display: flex;
    flex-direction: column;
    gap: 1.375rem;
    min-width: 0;
    margin-bottom: 1.375rem;

    @include xl {
      grid-column: 2;
      grid-row: 1 / span 2;
      /* Without this the item stretches over both rows and has no room left
         to slide, which reads as "sticky is broken". */
      align-self: start;
      position: sticky;
      top: calc($navbar-height + 1rem);
      margin-bottom: 0;
    }
  }
}

/* Design puts the "all vaults" escape hatch and the section switcher on one
   row above the vault identity, so the identity block owns the full width. */
.fund_topbar {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 1.75rem;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }
  }

  &__nav {
    margin-left: auto;
  }
}
</style>
