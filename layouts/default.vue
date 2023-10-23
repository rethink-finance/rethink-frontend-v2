<template>
  <v-app>
    <v-app-bar color="surface-variant" title="Application bar"></v-app-bar>
    <v-row justify="center" no-gutters>
      <!-- <v-navigation-drawer>
        <v-list>
          <v-list-item title="Drawer left"></v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-navigation-drawer location="right">
        <v-list>
          <v-list-item title="Drawer right"></v-list-item>
        </v-list>
      </v-navigation-drawer> -->
      <v-col class="" cols="12">
        <v-main
          class="d-flex align-center justify-center"
          style="min-height: 300px"
        >
          <slot />
        </v-main>
      </v-col>
      <v-col class="" cols="12">
        <v-footer class="bg-grey-lighten-1">
          <v-col class="text-center mt-4" cols="12">
            {{ new Date().getFullYear() }} — <strong>Rethink.finance</strong>
          </v-col>
        </v-footer>
      </v-col>
    </v-row>
  </v-app>
</template>
