<template>
  <v-app>
    <Navbar />

    <v-row justify="center" align="start" no-gutters>
      <v-col cols="12">
        <v-main class="main_layout d-flex align-start justify-center">
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

<style lang="scss" scoped>
main {
  position: relative;
  top: $navbar-height;
  min-height: calc(100vh - $navbar-height);
  padding-top: 1rem;
  width: 100%;
  margin: auto;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
  padding-bottom: 2rem;

  @include sm {
    padding-left: 0;
    padding-right: 0;
    width: 90%;
    padding-top: 3.5rem;
  }
  @include xl {
    width: 75%;
  }
  @include xxl {
    width: 60%;
  }
}
</style>
