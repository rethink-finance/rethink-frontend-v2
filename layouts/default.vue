<template>
  <v-app>
    <Navbar />

    <v-row justify="center" align="start" no-gutters>
      <v-col class="" cols="12">
        <v-main
          class="d-flex align-start justify-center"
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

</script>

<style scoped>
.v-btn--active {
  color: white;
}
</style>
