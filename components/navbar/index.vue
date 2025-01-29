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
            :key="route.to"
            :to="route.disabled ? undefined : route.to"
            :target="route.target"
          >
            <v-btn
              :class="`nav-link ${route.disabled ? 'disabled' : ''}`"
              variant="plain"
              :active="route.isActive"
              :color="route.pathColor"
            >
              {{ route.title }}
              <template #append>
                <Icon v-if="route.icon" :icon="route.icon" width="0.875rem" />
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
            <UiSelectChainButton
              v-if="accountStore.isConnected"
              v-model="selectedChainId"
              :loading="accountStore.isSwitchingNetworks"
              @selected-chain-changed="switchNetwork"
            />
            <v-btn
              class="connect_wallet_btn nav-link px-4"
              :class="{'connect_wallet_btn--connected': connectedWallet}"
              variant="outlined"
              :disabled="connectingWallet"
              :loading="connectingWallet"
              @click="onClickConnect"
            >
              <template v-if="connectedWallet?.icon">
                <div
                  v-if="isWalletIconSvg"
                  class="connect_wallet_btn__icon"
                  v-html="connectedWalletIcon"
                />
                <img
                  v-else
                  :src="connectedWalletIcon"
                  class="connect_wallet_btn__icon"
                >
              </template>
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
import { useAccountStore } from "~/store/account/account.store";
import type IRoute from "~/types/route";
const accountStore = useAccountStore();

const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);

const routes : IRoute[] = [
  {
    to: "/",
    matchPrefix: "/details",
    exactMatch: false,
    title: "Discover",
    text: "",
  },
  {
    to: "/create",
    exactMatch: true,
    title: "Create",
    text: "",
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
    text: "",
    icon: "mdi:launch",
    color: "var(--color-light-subtitle)",
  },
]
const selectedChainId = ref(accountStore.connectedWalletChainId);

watch(() => accountStore.connectedWalletChainId, (newVal, oldVal) => {
  console.log(`Connected Wallet Cain ID changed from ${oldVal} to ${newVal}`);
  selectedChainId.value = newVal || "";
});

const isSelectInputActive = ref(false);
const switchNetwork = async (chainId: string) => {
  try {
    await accountStore.switchNetwork(chainId)
    isSelectInputActive.value = false;
  } catch (error: any) {
    // Revert the selected value to the previously selected chain.
    selectedChainId.value = accountStore.connectedWalletChainId;
    isSelectInputActive.value = true;
  }
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
  const iconStr = accountStore.connectedWallet?.icon || "";
  return iconStr.replace(/\n+/g, " ").trim();
});


const isWalletIconSvg = computed(() => {
  const iconStr = connectedWalletIcon.value;
  if (!iconStr) return false;
  return iconStr.startsWith("<svg") && iconStr.endsWith("</svg>");
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
  .nav-link.disabled {
    opacity: 0.5;
  }

  .connect_wallet_btn {
    color: $color-primary;
    margin-left: .5rem;
    padding-block: 0.75rem;

    &__icon {
      width: 1.5rem;
      height: 1.5rem;
      margin-right: 0.5rem;

      :deep(svg) {
        width: 1.5rem;
        height: 1.5rem;
      }
    }

    &--connected {
      padding-block: .5rem;
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
</style>
