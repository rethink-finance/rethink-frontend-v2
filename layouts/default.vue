<template>
  <v-app>
    <v-app-bar color="background" elevation="2">
      <v-row ref="toolbar" align="center" justify="center">
        <v-toolbar
          color="transparent"
          style="letter-spacing: normal; padding: 0 116px"
          no-gutters
          flat
        >
          <v-btn
            :class="`hidden-md-and-up ${$vuetify.rtl ? 'ml-4' : 'mr-4'}`"
            icon
            small
          >
            <v-icon>mdi-menu</v-icon>
          </v-btn>

          <nuxt-link :to="'/'" class="d-flex">
            <Logo />
            <v-tooltip
              activator="parent"
              location="bottom"
            >Go to homepage
            </v-tooltip>
          </nuxt-link>
          <v-card
            color="transparent"
            class="transparent mt-1 mx-5 hidden-sm-and-down"
            flat
          >
            <nuxt-link :to="'/'" class="mx-1">
              <v-btn
                :active="
                  route.path === '/' || route.path.startsWith('/details')
                "
                :color="
                  route.path === '/' || route.path.startsWith('/details')
                    ? 'primary'
                    : 'white'
                "
                variant="plain"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
              >
                Discover
                <v-tooltip
                  activator="parent"
                  location="bottom"
                >Discover the funds and new opportunities</v-tooltip>
              </v-btn>
            </nuxt-link>
            <nuxt-link :to="'/create'" class="mx-1">
              <v-btn
                variant="plain"
                :color="route?.path === '/create' ? 'primary' : 'white'"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
                :active="route?.path === '/create'"
              >
                Create
                <v-tooltip
                  activator="parent"
                  location="bottom"
                >Create a fund and share it to your community</v-tooltip>
              </v-btn>
            </nuxt-link>
            <nuxt-link :to="'/governance'" class="mx-1">
              <v-btn
                variant="plain"
                :active="route?.path === '/governance'"
                :color="route?.path === '/governance' ? 'primary' : 'white'"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
              >
                Governance
                <v-tooltip
                  activator="parent"
                  location="bottom"
                >Govern the funds and allowances</v-tooltip>
              </v-btn>
            </nuxt-link>
          </v-card>
          <v-spacer class="hidden-sm-and-down" />
          <v-card
            color="transparent"
            class="transparent mt-1 mx-5 hidden-sm-and-down"
            flat
          >
            <a href="https://docs.rethink.finance" class="mx-1" target="_blank">
              <v-btn
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                variant="plain"
                color="white"
              >
                Documentation
                <v-tooltip
                  activator="parent"
                  location="bottom"
                >Read the protocol's docs</v-tooltip>
              </v-btn>
            </a>
            <v-btn
              style="
                text-transform: Capitalize;
                font-size: 16px;
                font-weight: 500;
              "
              variant="outlined"
              color="primary"
              class="ms-3"
            >
              Connect Wallet
              <v-tooltip
                activator="parent"
                location="bottom"
              >Connect the app to your web3 wallet</v-tooltip>
            </v-btn>
          </v-card>
        </v-toolbar>
      </v-row>
    </v-app-bar>


    <v-row justify="center" align="start" no-gutters>
      <v-col class="" cols="12">
        <v-main
          class="d-flex align-start justify-center"
          style="min-height: calc(100vh - 90px)"
        >
          <slot />
        </v-main>
      </v-col>
      <v-col class="" cols="12">
        <Footer />
      </v-col>
    </v-row>
  </v-app>
</template>

<script setup>
const route = useRoute();

const currentRoute = ref(route?.path);

onMounted(async () => {
  currentRoute.value = route.path;
});
</script>

<style scoped>
.v-btn--active {
  color: white;
}
</style>
