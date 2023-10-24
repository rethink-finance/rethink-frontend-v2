<template>
  <v-row ref="toolbar" align="center" justify="center">
    <v-toolbar
      color="transparent"
      style="letter-spacing: normal"
      no-gutters
      flat
    >
    </v-toolbar>
    <v-btn
      :class="`hidden-md-and-up ${$vuetify.rtl ? 'ml-4' : 'mr-4'}`"
      icon
      small
      @click.stop="openNavDrawer"
    >
      <v-icon>mdi-menu</v-icon>
    </v-btn>
    <v-card
      v-if="collapseOnScroll > 800"
      width="150px"
      class="transparent mt-1 mx-5 hidden-sm-and-down"
      flat
    >
      <nuxt-link :to="'/'">
        <Logo />
      </nuxt-link>
    </v-card>
  </v-row>
</template>
