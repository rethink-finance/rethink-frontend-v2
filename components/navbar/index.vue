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
                <Icon v-if="route.icon" :name="route.icon" size="0.875rem" />
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
              v-if="accountsStore.isConnected"
              v-model="selectedChainId"
              class="select_network"
              density="compact"
              :bg-color="selectedChainId ? '' : 'error'"
              label="Network"
              :items="networks"
              item-title="name"
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
    v-if="accountsStore.isConnected && !selectedChainId"
    color="error"
    title="Unsupported Network"
    class="unsupported_network_alert"
    text="You are on an unsupported network, please switch to one of the supported ones."
  />
  <NavbarMenuList v-model="menuOpen" :routes="computedRoutes" />
</template>

<script lang="ts" setup>
import { useAccountsStore } from "~/store/accounts.store";
import { useToastStore } from "~/store/toast.store";
const accountsStore = useAccountsStore();
const toastStore = useToastStore();

const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);
interface IRoute {
  to: string;
  title: string;
  text: string;
  exactMatch: boolean;
  matchPrefix?: string;
  disabled?: boolean;
  isExternal?: boolean;
  icon?: string;
  color?: string;
}
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
const selectedChainId = ref("");
const networks = [
  { chainId: "0x5", name: "Goerli Testnet" },
  { chainId: "0x89", name: "Polygon" },
  { chainId: "0x2a", name: "Kovan Testnet" },
  { chainId: "0x13881", name: "Mumbai Testnet" },
  { chainId: "0xa869", name: "Fuji Testnet" },
  { chainId: "0x1e15", name: "Canto Testnet" },
  { chainId: "0x66eed", name: "Arbitrum Goerli Testnet" },
  { chainId: "0xa4b1", name: "Arbitrum One" },  // Assuming an example chainId for Arbitrum One
];
watch(() => accountsStore.chainId, (newVal, oldVal) => {
  console.log(`Chain ID changed from ${oldVal} to ${newVal}`);
  // Perform additional actions when chainId changes
  selectedChainId.value = newVal || "";
});
const switchNetwork = async (chainId: string) => {
  console.log(chainId);
  try {
    await accountsStore.connectedWallet?.provider?.request({
      method: "wallet_switchEthereumChain",
      params: [{
        chainId,
      }],
    });
  } catch (error: any) {
    selectedChainId.value = "";

    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        // Add the network if it is not yet added.
        // TODO: finish this for better UX, get network RPC mapping
        // await accountsStore.connectedWallet?.provider.request({
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
}
const isPathActive = (path: string = "", exactMatch = true) => exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "var(--color-subtitle)") => (isActive ? "primary" : color);

const computedRoutes = computed(() => {
  return routes.map((routeItem) => {
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

const activeAccount = computed(() => truncateAddress(accountsStore.activeAccount?.address));
const connectingWallet = computed(() => accountsStore.connectingWallet);
const connectedWallet = computed(() => accountsStore.connectedWallet);
const connectedWalletIcon = computed(() => {
  if (!accountsStore?.connectedWallet) return "";
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(accountsStore.connectedWallet?.icon)))}`
});

onMounted(() => {
  currentRoute.value = route.path;
});

const onClickConnect = () => {
  const { provider, label } = connectedWallet.value || {}

  if (provider && label) {
    accountsStore.disconnectWallet()
  } else {
    accountsStore.connectWallet()
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
    font-size: 16px;
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
