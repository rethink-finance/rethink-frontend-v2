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
            <nuxt-link
              to="https://docs.rethink.finance"
              target="_blank"
              class="mr-2"
            >
              <v-btn
                class="nav-link"
                variant="plain"
                color="var(--color-light-subtitle)"
              >
                Docs
                <template #append>
                  <Icon  icon="mdi:launch" width="0.875rem" />
                </template>
              </v-btn>
            </nuxt-link>

            <UiButtonSelectChain
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

            <v-menu location="bottom" :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn class="btn_settings" v-bind="props">
                  <v-icon class="icon_settings" icon="mdi-cog" size="1.5rem" />
                </v-btn>
              </template>
              <v-list>
                <v-list-item>
                  <v-list-item-title>
                    <v-switch
                      v-model="appSettingsStore.isManageMode"
                      label="Manage Mode"
                      color="primary"
                      hide-details
                      @change="appSettingsStore.toggleAdvancedMode"
                    />
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
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
import { useSettingsStore } from "~/store/settings/settings.store";
import { type ChainId } from "~/types/enums/chain_id";
import type IRoute from "~/types/route";
const accountStore = useAccountStore();

const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);
const appSettingsStore = useSettingsStore();

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
]
const selectedChainId = ref(accountStore.connectedWalletChainId);

watch(() => accountStore.connectedWalletChainId, (newVal, oldVal) => {
  console.log(`Connected Wallet Cain ID changed from ${oldVal} to ${newVal}`);
  selectedChainId.value = newVal;
});

const isSelectInputActive = ref(false);
const switchNetwork = async (chainId: ChainId) => {
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
      isHidden: routeItem.to === "/create" ? !appSettingsStore.isManageMode : false,

    };
  }).filter((routeItem: IRoute) => !routeItem.isHidden);
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

  .btn_settings {
    margin-left: .5rem;
    padding: 0.5rem;

    &:hover {
      .icon_settings {
        transform: rotate(90deg);
      }
    }
  }
  .icon_settings{
    transition: transform 0.3s ease-in-out;
    transform: rotate(0deg);
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
