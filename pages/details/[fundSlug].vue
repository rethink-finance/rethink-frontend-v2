<template>
  <div v-if="isLoadingFetchFundData" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="w-100">
    <div v-if="breadcrumbItems.length === 0" class="fund_name">
      <v-avatar class="fund_name__avatar" :rounded="false">
        <img
          :src="fund.photoUrl"
          class="fund_name__avatar_img"
          alt="fund cover image"
        >
      </v-avatar>
      <div class="fund_name__title">
        <p>
          {{ fund?.fundToken.symbol }}
        </p>
      </div>
      <div class="fund_name__subtitle">
        <p>
          {{ fund?.title }}
        </p>
      </div>
    </div>
    <div v-if="breadcrumbItems.length === 0" class="details_nav_container">
      <div class="details_nav">
        <div class="overlay-container" />
        <nuxt-link
          v-for="navRoute in computedRoutes"
          :key="navRoute.to"
          :to="navRoute.to"
          class="link"
        >
          <v-btn
            class="nav-link"
            variant="plain"
            :active="navRoute.isActive"
            :color="navRoute.pathColor"
          >
            <div :class="{ 'title-box': navRoute.isActive }">
              {{ navRoute.title }}
            </div>
          </v-btn>
        </nuxt-link>
      </div>
    </div>
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
      OIV not found
    </h2>
    <p class="text-center">
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
import type IFund from "~/types/fund";
import type IRoute from "~/types/route";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { ChainId } from "~/store/web3/networksMap";

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

const isPathActive = (path: string = "", exactMatch = true) =>
  exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "#77839f") =>
  isActive ? "primary" : color;

const computedRoutes = computed(() => {
  return routes.map((routeItem: IRoute) => {
    let isActive;
    if (routeItem.exactMatch) {
      isActive = isPathActive(routeItem.to, true);
    } else if (
      isPathActive(routeItem.matchPrefix, false) ||
      isPathActive(routeItem.to, true)
    ) {
      isActive = true;
    } else {
      isActive = false;
    }

    return {
      ...routeItem,
      isActive,
      pathColor: getPathColor(isActive, routeItem.color),
      target: routeItem.isExternal ? "_blank" : "",
    };
  });
});
</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
.details_nav {
  position: relative;
  padding-top: 8px;
  width: 100%;
}

.details_nav_container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 4px;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: 8px;
  margin-bottom: 40px;

  background-color: $color-bg-transparent;
  border-radius: 4px;

  @include sm {
    padding-left: 0;
    padding-right: 0;
  }
}

.link {
  &:first-of-type {
    .nav-link {
      padding-left: 8px;
    }
  }
}

.nav-link {
  height: 100%;
  text-transform: Capitalize;
  font-size: 1rem;
  font-weight: 700;
  padding: 0.5rem;

  &:not(:hover) {
    opacity: 0.85;
  }
}

.title-box {
  position: relative;
  border-bottom: 2px solid;
  border-color: var(--color-primary);
  padding-bottom: 1rem;
}

.overlay-container {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);

  background-color: var(--color-divider);
  width: calc(100% - 16px);
  height: 2px;
}

.fund_name {
  background-color: $color-bg-transparent;
  border-radius: $default-border-radius;
  padding: 0.5rem 0.62rem;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;

  @include sm {
    padding: 8px;
  }

  &__avatar {
    border: 0;
  }

  &__avatar_img {
    border-radius: 50%;
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  &__title {
    font-weight: 700;
    font-size: $text-md;
  }

  &__subtitle {
    font-weight: 500;
    font-size: $text-sm;
    color: $color-text-irrelevant;
  }
}

.breadcrumbs {
  margin-bottom: 32px;
}
</style>
