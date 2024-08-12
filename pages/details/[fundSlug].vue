<template>
  <div v-if="loading" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="w-100">
    <div class="fund-name">
      <v-avatar size="4rem" rounded="">
        <img
          :src="fund.photoUrl"
          class="fund-name__avatar_img"
          alt="fund cover image"
        >
      </v-avatar>
      <div class="fund-name__title">
        <p>
          {{ fund?.fundToken.symbol }}
        </p>
      </div>
      <div class="fund-name__subtitle">
        <p>
          {{ fund?.title }}
        </p>
      </div>
    </div>
    <div class="details_nav_container">
      <div class="details_nav">
        <div class="overlay-container" />
        <nuxt-link
          v-for="navRoute in computedRoutes"
          :key="navRoute.to"
          :to="navRoute.to"
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

      <div>
        <UiBreadcrumbs :items="breadcrumbItems" />
      </div>
    </div>
    <NuxtPage :fund="fund" @update-breadcrumbs="setBreadcrumbItems" />
  </div>
  <div v-else-if="isSwitchingNetworks" class="w-100 d-flex justify-center">
    <v-progress-circular indeterminate />
  </div>
  <div v-else class="d-flex flex-column h-100 align-center">
    <h2 class="mb-2">
      Fund not found
    </h2>
    <p class="text-center">
      Are you sure you are on the right network? <br>
      Try switching to a different network.
    </p>
  </div>
</template>

<script lang="ts" setup>
import { trimTrailingSlash } from "~/composables/utils";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";
import type IRoute from "~/types/route";
import type BreadcrumbItem from "~/types/ui/breadcrumb";

const accountStore = useAccountStore();
const toastStore = useToastStore();
const fundStore = useFundStore();
const web3Store = useWeb3Store();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const isSwitchingNetworks = ref(false);
// fund address is always in the third position of the route
// e.g. /details/0xa4b1-TFD3-0x1234 -> 0x1234
const [chainId, tokenSymbol, fundAddress] = route.path.split("/")[2].split("-");

onUnmounted(() => {
  fundStore.fund = {} as IFund;
  fundStore.selectedFundAddress = "";
  setBreadcrumbItems([]);
});

const breadcrumbItems = ref<BreadcrumbItem[]>([]);
const setBreadcrumbItems = (items: BreadcrumbItem[]) => {
  breadcrumbItems.value = items;
};

const fetchFund = async () => {
  if (!fundAddress) {
    console.error("No fund address provided in the route.");
    return;
  }

  loading.value = true;
  try {
    await fundStore.getFund(fundAddress);
  } catch (e) {
    console.error("Failed fetching fund -> ", e);
  }
  loading.value = false;

  fundStore.fetchFundNAVUpdates();
  fundStore.fetchUserBalances();
};

// TODO: two watchers ? can we combine them?
watch(
  () => web3Store.chainId,
  () => {
    fetchFund();
  },
);
// Watch for route changes to reset the breadcrumbs
watch(
  () => route.path,
  (newPath) => {
    const pathRoot = `${fundDetailsRoute}`;
    console.log(newPath);
    if (
      trimTrailingSlash(newPath) === pathRoot ||
      newPath === `${pathRoot}/nav`
    ) {
      setBreadcrumbItems([]);
    }
  },
);

const switchNetwork = async (chainId: string) => {
  isSwitchingNetworks.value = true;
  try {
    if (accountStore.connectedWallet) {
      // Ask the connected user to switch network.
      await accountStore.setActiveChain(chainId);
    } else {
      // Switch active chain.
      await web3Store.init(chainId);
    }

    // Test connection, outer catch block will except exception.
    try {
      await web3Store.checkConnection();
    } catch (e: any) {
      toastStore.errorToast("Looks like there are RPC connection problems.")
    }

  } catch (error: any) {
    // Redirect to the home page if the user cancels the network switch
    router.push("/");

    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        // Add the network if it is not yet added.
        // TODO: finish this for better UX, get network RPC mapping
        // await accountStore.connectedWallet?.provider.request({
        //   method: 'wallet_addEthereumChain',
        //   params: [{
        //     chainId: chainId,
        //     rpcUrl: 'https://rpc-mainnet.maticvigil.com/',
        //     chainName: 'Polygon Mainnet',
        //     nativeCurrency: {
        //       name: 'MATIC',
        //       symbol: 'MATIC', // 2-6 characters long
        //       decimals: 18,
        //     },
        //     blockExplorerUrls: ['https://polygonscan.com']
        //   }]
        // });
        toastStore.errorToast(
          "Oops, something went wrong switching networks. " +
          "Check if the network is added to your wallet provider.",
        )
      } catch (addError) {
        console.error("Failed to add the network:", addError);
      }
    } else {
      toastStore.errorToast("Oops, something went wrong switching networks.")
    }
  }
  isSwitchingNetworks.value = false;
}

onMounted(() => {
  fetchFund();
  setBreadcrumbItems([]);

  // check if we are on correct chainId
  if (chainId !== web3Store.chainId) {
    switchNetwork(chainId);
  }

});
const fund = computed(() => fundStore.fund as IFund);
const fundDetailsRoute = computed(
  () => `/details/${chainId}-${tokenSymbol}-${fundAddress}`,
);



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
    text:"",
  },
];

const isPathActive = (path: string = "", exactMatch = true) =>
  exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "var(--color-subtitle)") =>
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
  margin-bottom: 1rem;
  padding-top: 1rem;
  width: 100%;
}

.details_nav_container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 1rem;
  padding-left: 1rem;
  padding-right: 1rem;
  margin-bottom: 1rem;

  @include sm {
    padding-left: 0;
    padding-right: 0;
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
  background-color: var(--color-divider);
  width: 100%;
  height: 2px;
}

.fund-name {
  background-color: $color-gray-light-transparent;
  border-radius: $default-border-radius;
  padding: 0.5rem 0.62rem;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;

  @include sm {
    padding: 1rem 1.5rem;
  }

  &__avatar_img {
    border-radius: 0.25rem;
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
</style>
