<template>
  <v-app-bar
    class="navbar"
    color="background"
    elevation="2"
  >
    <v-row
      ref="toolbar"
      align="center"
      justify="center"
      no-gutters
    >
      <v-toolbar
        class="navbar__toolbar"
        color="transparent"
        no-gutters
        flat
      >
        <nuxt-link :to="'/'" class="d-flex">
          <Logo />
          <v-tooltip activator="parent" location="bottom">
            Go to homepage
          </v-tooltip>
        </nuxt-link>
        <div class="navbar__buttons hidden-sm-and-down">
          <nuxt-link
            v-for="route in computedRoutes"
            :to="route.to"
            :target="route.target"
          >
            <v-btn
              class="nav-link"
              variant="plain"
              :active="route.isActive"
              :color="route.pathColor"
              :disabled="route.disabled"
            >
              {{ route.title }}
              <template #append>
                <Icon v-if="route.icon" :name="route.icon" width="0.875rem" />
              </template>
              <v-tooltip v-if="route.text" activator="parent" location="bottom">
                {{ route.text }}
              </v-tooltip>
            </v-btn>
          </nuxt-link>
        </div>

        <v-spacer class="hidden-sm-and-down" />

        <ClientOnly>
          <div class="d-flex">
            <v-select
              v-model="selectedChainId"
              class="select_network"
              density="compact"
              :bg-color="selectedChainId ? '' : 'error'"
              label="Network"
              :items="networks"
              :loading="isSwitchingNetworks"
              item-title="chainName"
              item-value="chainId"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props" @click="switchNetwork(item.raw.chainId)" />
              </template>
            </v-select>
            <v-btn
              class="connect_wallet_btn nav-link px-4 py-3"
              :class="{'connect_wallet_btn--connected': connectedWallet}"
              variant="outlined"
              :disabled="connectingWallet"
              :loading="connectingWallet"
              @click="onClickConnect"
            >
              <img
                v-if="connectedWallet?.icon"
                :src="connectedWalletIcon"
                class="connect_wallet_btn__icon"
              >
              {{
                connectedWallet
                  ? activeAccount
                  : 'Connect'
              }}
              <v-tooltip activator="parent" location="bottom">
                {{
                  connectedWallet
                    ? "Disconnect your wallet."
                    : "Connect the app to your web3 wallet."
                }}
              </v-tooltip>
            </v-btn>
          </div>
        </ClientOnly>

        <v-btn class="menu_btn fill-height hidden-md-and-up" @click="menuOpen = !menuOpen">
          <v-icon size="1.5rem">
            mdi-menu
          </v-icon>
        </v-btn>
      </v-toolbar>
    </v-row>
  </v-app-bar>

  <v-alert
    v-if="accountStore.isConnected && !selectedChainId"
    color="error"
    title="Unsupported Network"
    class="unsupported_network_alert"
    text="You are on an unsupported network, please switch to one of the supported ones."
  />
  <NavbarMenuList v-model="menuOpen" :routes="computedRoutes" />
</template>

<script lang="ts" setup>
import { useAccountStore } from "~/store/account.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import type INetwork from "~/types/network";
import type IRoute from "~/types/route";
const accountStore = useAccountStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();

const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);

const routes : IRoute[] = [
  {
    to: "/",
    matchPrefix: "/details",
    exactMatch: false,
    title: "Discover",
    text: "Find the most favorable opportunities",
  },
  {
    to: "/create",
    exactMatch: true,
    title: "Create",
    text: "Coming soon",
    disabled: true,
  },
  {
    to: "/governance",
    exactMatch: true,
    title: "Governance",
    text: "Coming soon",
    disabled: true,
  },
  {
    isExternal: true,
    exactMatch: true,
    to: "https://docs.rethink.finance",
    title: "Docs",
    text: "Delve into the details of the protocol",
    icon: "mdi:launch",
    color: "var(--color-light-subtitle)",
  },
]
const selectedChainId = ref(web3Store.chainId);
const networks: INetwork[] = web3Store.networks;
const isSwitchingNetworks = ref(false);

watch(() => web3Store.chainId, (newVal, oldVal) => {
  console.log(`Chain ID changed from ${oldVal} to ${newVal}`);
  // Perform additional actions when chainId changes
  selectedChainId.value = newVal || "";
});

const checkConnection = async () => {
  return await web3Store?.web3?.eth.getBlockNumber();
}

const switchNetwork = async (chainId: string) => {
  isSwitchingNetworks.value = true;
  try {
    if (accountStore.connectedWallet) {
      // Ask the connected user to switch network.
      await accountStore.setActiveChain(chainId);
    } else {
      // Switch active chain.
      web3Store.init(chainId);
    }

    // Test connection, outer catch block will except exception.
    try {
      await checkConnection();
    } catch (e: any) {
      toastStore.errorToast("Looks like there are RPC connection problems.")
    }

  } catch (error: any) {
    // Revert the selected value to the previously selected chain.
    selectedChainId.value = web3Store.chainId;

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
const isPathActive = (path: string = "", exactMatch = true) => exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "var(--color-subtitle)") => (isActive ? "primary" : color);

const computedRoutes = computed(() => {
  return routes.map((routeItem: IRoute) => {
    let isActive;
    if (routeItem.exactMatch) {
      isActive = isPathActive(routeItem.to, true)
    } else if (
      isPathActive(routeItem.matchPrefix, false) ||
      isPathActive(routeItem.to, true)) {
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

const activeAccount = computed(() => truncateAddress(accountStore.activeAccount?.address));
const connectingWallet = computed(() => accountStore.connectingWallet);
const connectedWallet = computed(() => accountStore.connectedWallet);
const connectedWalletIcon = computed(() => {
  if (!accountStore?.connectedWallet) return "";
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(accountStore.connectedWallet?.icon)))}`
});

onMounted(() => {
  currentRoute.value = route.path;
});

const onClickConnect = async () => {
  const { provider, label } = connectedWallet.value || {}

  if (provider && label) {
    await accountStore.disconnectWallet()
  } else {
    await accountStore.connectWallet()
  }
}
</script>

<style scoped lang="scss">
.navbar {
  ::v-deep(.v-toolbar__content) {
    height: $navbar-height !important;
    width: 100%;
    justify-content: space-between;

    .v-btn.menu_btn {
      margin-right: 0;
    }
  }

  &__toolbar {
    letter-spacing: normal;
    gap: 2rem;
    display: flex;
    flex-direction: row;
    padding: 0 0 0 1.5rem;

    @include sm {
      padding: 0 2rem;
    }

    @include lg {
      padding: 0 7.25rem;
    }
  }

  &__buttons {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    margin-left: 2.5rem;
    height: 100%;
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

  .connect_wallet_btn {
    color: $color-primary;

    &__icon {
      width: 1.5rem;
      height: 1.5rem;
      margin-right: 0.5rem;
    }

    &--connected {
      color: $color-light-subtitle;
      border-color: $color-gray-transparent;
    }
  }
}
.unsupported_network_alert {
  position: absolute;
  margin: auto;
  top: $navbar-height;
  width: 100%;

  :deep(.v-alert__content) {
    margin: auto;
  }
}
.select_network {
  min-width: 9rem;
}
</style>
