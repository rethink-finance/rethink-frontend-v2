<template>
  <v-app-bar
    class="navbar"
    color="background"
    elevation="2"
  >
    <v-row ref="toolbar" align="center" justify="center">
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

        <div class="mx-3">
          <v-btn
            class="nav-link px-4 py-3"
            variant="outlined"
            color="primary"
          >
            Connect Wallet
            <v-tooltip activator="parent" location="bottom">
              Connect the app to your web3 wallet.
            </v-tooltip>
          </v-btn>
        </div>

        <v-btn class="fill-height hidden-md-and-up" @click="menuOpen = !menuOpen">
          <v-icon size="1.5rem">
            mdi-menu
          </v-icon>
        </v-btn>
      </v-toolbar>
    </v-row>
  </v-app-bar>

  <NavbarMenuList v-model="menuOpen" :routes="computedRoutes" />
</template>

<script setup>
const route = useRoute();

const currentRoute = ref(route?.path);
const menuOpen = ref(false);

onMounted(async () => {
  currentRoute.value = route.path;
});

const routes = [
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
    to: "https://docs.rethink.finance",
    title: "Docs",
    text: "Delve into the details of the protocol",
    icon: "mdi:launch",
    color: "var(--color-light-subtitle)",
  },
]

const isPathActive = (path, exactMatch = true) => exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (path, isActive = false, color = "var(--color-subtitle)") => (isActive ? "primary" : color);

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
      pathColor: getPathColor(routeItem.to, isActive, routeItem.color),
      target: routeItem.isExternal ? "_blank" : "",
    };
  });
});
</script>

<style scoped lang="scss">
.navbar {
  ::v-deep(.v-toolbar__content) {
    height: $navbar-height !important;
    width: 100%;
    justify-content: space-between;
  }

  &__toolbar {
    letter-spacing: normal;
    gap: 2rem;
    display: flex;
    flex-direction: row;
    padding: 0 2rem;

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
}
</style>
