<template>
  <v-app>
    <v-app-bar color="background" flat>
      <v-row ref="toolbar" align="center" justify="center">
        <v-toolbar
          color="transparent"
          style="letter-spacing: normal; padding: 0px 116px"
          no-gutters
          flat
        >
          <v-btn
            :class="`hidden-md-and-up ${$vuetify.rtl ? 'ml-4' : 'mr-4'}`"
            icon
            small
            @click.stop="openNavDrawer"
          >
            <v-icon>mdi-menu</v-icon>
          </v-btn>

          <nuxt-link :to="'/'">
            <Logo />
            <v-tooltip activator="parent" location="bottom"
              >Go to homepage</v-tooltip
            >
          </nuxt-link>
          <v-card
            color="transparent"
            class="transparent mt-1 mx-5 hidden-sm-and-down"
            flat
          >
            <nuxt-link :to="'/'" class="mx-1">
              <v-btn
                :active="false"
                color="white"
                variant="plain"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
              >
                Discover
                <v-tooltip activator="parent" location="bottom"
                  >Discover the funds and new opportunities</v-tooltip
                >
              </v-btn>
            </nuxt-link>
            <nuxt-link :to="'/create'" class="mx-1">
              <v-btn
                variant="plain"
                color="white"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
              >
                Create
                <v-tooltip activator="parent" location="bottom"
                  >Create a fund and share it to your community</v-tooltip
                >
              </v-btn>
            </nuxt-link>
            <nuxt-link :to="'/governance'" class="mx-1">
              <v-btn
                variant="plain"
                color="white"
                style="
                  text-transform: Capitalize;
                  font-size: 16px;
                  font-weight: 300;
                "
                class="nav-link"
              >
                Governance
                <v-tooltip activator="parent" location="bottom"
                  >Govern the funds and allowances</v-tooltip
                >
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
                <v-tooltip activator="parent" location="bottom"
                  >Read the protocol's docs</v-tooltip
                >
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
              <v-tooltip activator="parent" location="bottom"
                >Connect the app to your web3 wallet</v-tooltip
              >
            </v-btn>
          </v-card>
        </v-toolbar>
      </v-row>
    </v-app-bar>
    <v-row justify="center" no-gutters>
      <!-- <v-navigation-drawer>
        <v-list>
          <v-list-item title="Drawer left"></v-list-item>
        </v-list>
      </v-navigation-drawer> -->
      <v-col class="" cols="12">
        <v-main
          class="d-flex align-center justify-center"
          style="min-height: calc(100vh - 90px)"
        >
          <slot />
        </v-main>
      </v-col>
      <v-col class="" cols="12">
        <v-footer color="transparent" class="px-16">
          <v-col
            class="text-start ps-16"
            style="padding-start: 116px"
            cols="12"
            sm="12"
            md="6"
          >
            <a href="https://#" class="mx-1" target="_blank">
              <v-btn icon variant="plain">
                <Icon
                  name="ri:twitter-x-line"
                  color="white"
                  size="20px"
                  class="mr-3"
                />
              </v-btn>
            </a>
            <a href="https://#" class="mx-1" target="_blank">
              <v-btn icon variant="plain">
                <Icon
                  name="ic:baseline-discord"
                  color="white"
                  size="26px"
                  class="mr-3"
                />
              </v-btn>
            </a>
            <a href="https://#" class="mx-1" target="_blank">
              <v-btn icon variant="plain">
                <Icon
                  name="mdi:youtube"
                  color="white"
                  size="26px"
                  class="mr-3"
                />
              </v-btn>
            </a>
            <a href="https://#" class="mx-1" target="_blank">
              <v-btn icon variant="plain">
                <Icon
                  name="ph:medium-logo-fill"
                  color="white"
                  size="26px"
                  class="mr-3"
                />
              </v-btn>
            </a>
            <a href="https://#" class="mx-1" target="_blank">
              <v-btn icon variant="plain">
                <Icon
                  name="uil:github"
                  color="white"
                  size="24px"
                  class="mr-3"
                />
              </v-btn>
            </a>
          </v-col>
          <v-col
            class="d-flex justify-end align-center text-end pe-16"
            style="padding-end: 116px"
            cols="12"
            sm="12"
            md="6"
          >
            <Icon
              name="ic:baseline-copyright"
              color="white"
              size="20px"
              class="me-1"
            />
            {{ new Date().getFullYear() }} Rethink.finance. All rights reserved
          </v-col>
        </v-footer>
      </v-col>
    </v-row>
  </v-app>
</template>

<style scoped>
.v-btn--active {
  color: white;
}
</style>
