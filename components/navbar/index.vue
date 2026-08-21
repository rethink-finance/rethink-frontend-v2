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
        <nav class="navbar__buttons hidden-sm-and-down">
          <template v-for="route in computedRoutes" :key="route.to">
            <!-- Disabled entries are plain text with a mono tag. -->
            <div v-if="route.disabled" class="nav_item nav_item--disabled">
              {{ route.title }}
              <span v-if="route.badge" class="nav_item__badge">
                {{ route.badge }}
              </span>
            </div>
            <nuxt-link
              v-else
              class="nav_item"
              :class="{ 'nav_item--active': route.isActive }"
              :to="route.to"
              :target="route.target"
            >
              {{ route.title }}
              <Icon v-if="route.icon" :icon="route.icon" width="0.875rem" />
            </nuxt-link>
          </template>
        </nav>

        <v-spacer class="hidden-sm-and-down" />

        <ClientOnly>
          <div class="d-flex">
            <nuxt-link
              to="https://docs.rethink.finance"
              target="_blank"
              class="nav_item nav_item--compact mr-2"
            >
              Docs
              <Icon icon="mdi:launch" width="0.8125rem" />
            </nuxt-link>

            <!-- No network picker: a contract call switches the wallet itself
                 (see CustomContract.ensureCorrectNetwork), so choosing a chain
                 by hand was work the wallet already does. -->
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

            <v-menu
              location="bottom end"
              offset="10"
              :close-on-content-click="false"
            >
              <template #activator="{ props }">
                <button
                  class="settings_btn"
                  :class="{ 'settings_btn--on': appSettingsStore.isManageMode }"
                  type="button"
                  aria-label="Settings"
                  v-bind="props"
                >
                  <v-icon class="settings_btn__icon" icon="mdi-cog-outline" size="18" />
                </button>
              </template>

              <div class="settings_menu">
                <div class="settings_menu__eyebrow">
                  Mode
                </div>
                <div class="settings_toggle" @click="toggleCuratorMode">
                  <div class="settings_toggle__text">
                    <div class="settings_toggle__title">
                      Curator Mode
                    </div>
                    <div class="settings_toggle__hint">
                      Create and manage vaults
                    </div>
                  </div>
                  <!-- The design system's switch, not v-switch: the row is a
                       32x18 track with a cyan knob, and Vuetify's inset switch
                       renders a bright primary-filled track that reads as a
                       different control from every other toggle in the app. -->
                  <OnboardingToggle
                    :model-value="appSettingsStore.isManageMode"
                    label="Curator Mode"
                    @click.stop
                    @update:model-value="toggleCuratorMode"
                  />
                </div>
              </div>
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

  <div
    v-if="accountStore.isConnected && !connectedChainId"
    class="brand_note brand_note--warning unsupported_network_alert"
  >
    <Icon
      icon="material-symbols:warning-outline"
      class="brand_note__icon"
    />
    <div class="brand_note__body">
      <div class="brand_note__title">
        Unsupported network
      </div>
      <div class="brand_note__text">
        You are on an unsupported network. Switch to a supported one in your wallet,
        or open a vault and the app will ask your wallet to switch.
      </div>
    </div>
  </div>
  <NavbarMenuList v-model="menuOpen" :routes="computedRoutes" />
</template>

<script lang="ts" setup>
import { useAccountStore } from "~/store/account/account.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import type IRoute from "~/types/route";
const accountStore = useAccountStore();

const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);
const appSettingsStore = useSettingsStore();

const routes = computed<IRoute[]>(() => [
  {
    to: "/",
    matchPrefix: "/details",
    exactMatch: false,
    title: "Discover",
    text: "",
  },
  // Positions only exist for a wallet, so the design shows Portfolio
  // exclusively while one is connected.
  ...(accountStore.isConnected
    ? [{
      to: "/portfolio",
      exactMatch: true,
      title: "Portfolio",
      text: "",
    }]
    : []),
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
    badge: "SOON",
  },
])
/**
 * Only the unsupported-network warning reads this now. It was a writable ref
 * while the picker could set it; nothing writes to it since, so it just
 * follows the wallet.
 */
const connectedChainId = computed(() => accountStore.connectedWalletChainId);

/** Toggling anywhere on the row, not just the switch itself. */
const toggleCuratorMode = () => {
  appSettingsStore.isManageMode = !appSettingsStore.isManageMode;
  appSettingsStore.toggleAdvancedMode();
};

const isPathActive = (path: string = "", exactMatch = true) => exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "var(--color-subtitle)") => (isActive ? "primary" : color);

const computedRoutes = computed(() => {
  return routes.value.map((routeItem: IRoute) => {
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

  /* Settings trigger: quiet square that lights up in brand cyan while
     Curator Mode is on, so the active state is readable at a glance. */
  .settings_btn {
    flex: none;
    width: 36px;
    height: 36px;
    margin-left: 0.5rem;
    display: grid;
    place-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    cursor: pointer;
    transition:
      color $default-transition-time ease,
      border-color $default-transition-time ease,
      background $default-transition-time ease,
      box-shadow $default-transition-time ease;

    &__icon {
      transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    }

    &:hover {
      color: $color-white;
      border-color: $color-line-2;

      .settings_btn__icon {
        transform: rotate(90deg);
      }
    }

    &--on {
      color: $color-cyan;
      background: $color-accent-soft;
      border-color: $color-accent-line;

      &:hover {
        color: $color-cyan-soft;
        border-color: $color-accent-line;
        box-shadow: 0 0 0 3px rgba(22, 200, 255, 0.08);
      }
    }
  }



  /* The bar itself is full bleed — background and hairline span the viewport —
     while this inner row sits in the shared page container, so the logo and
     the right-hand controls land on the same edges as the page below. */
  &__toolbar {
    @include page-container;
    letter-spacing: normal;
    gap: 2rem;
    display: flex;
    flex-direction: row;
  }

  &__buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    margin-left: 1.25rem;
    height: 100%;
  }

  /* Design-file nav item: 14px semibold, dim by default,
     brand blue when active, faint + SOON tag when disabled. */
  .nav_item {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    box-sizing: border-box;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    color: $color-text-irrelevant;
    transition: color $default-transition-time ease;

    /* Selected and hovered both read as white; unselected sits dim. */
    &:hover,
    &--active,
    &--active:hover {
      color: $color-white;
    }

    /* Right-side links (Docs) sit inline rather than full height. */
    &--compact {
      height: auto;
      gap: 6px;
      padding: 8px 10px;
    }

    /* Not available yet — dimmer still, and inert: no hover response. */
    &--disabled,
    &--disabled:hover {
      color: $color-steel-blue;
      opacity: 0.45;
      cursor: default;
    }

    &__badge {
      font-family: $font-mono;
      font-size: 10px;
      letter-spacing: 0.1em;
      line-height: 1.4;
      text-transform: uppercase;
      color: $color-steel-blue;
      border: 1px solid $color-line-2;
      border-radius: $default-border-radius;
      padding: 2px 6px;
    }
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
/* Dropdown panel — raised surface with a hairline, matching the
   design system's menu treatment. Lives in an overlay, so it sits
   outside .navbar. */
.settings_menu {
  min-width: 264px;
  padding: 0.75rem;
  background: $color-navy-gray-light;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    padding: 0 0.25rem 0.5rem;
  }
}

.settings_toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
  border-radius: $default-border-radius;
  cursor: pointer;
  user-select: none;
  transition: background $default-transition-time ease;

  &:hover {
    background: $color-gray-light-transparent;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__title {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.2;
    color: $color-white;
  }

  &__hint {
    font-size: 11.5px;
    line-height: 1.3;
    color: $color-steel-blue;
  }

}

/* Spans the viewport under the bar rather than sitting in a page's column —
   the network is wrong for the whole app, not for one screen. */
.unsupported_network_alert {
  position: absolute;
  top: $navbar-height;
  width: 100%;
  border-inline: none;
  border-radius: 0;
  padding-inline: 1.5rem;
  z-index: 1004;
}
</style>
