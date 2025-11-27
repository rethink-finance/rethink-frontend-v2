<template>
  <v-app>
    <Navbar />

    <v-main class="d-flex align-start justify-center">
      <slot />
    </v-main>

    <div>
      <Footer />
    </div>
  </v-app>
</template>

<script setup>

</script>

<style lang="scss" scoped>
main {
  padding-top: calc($navbar-height + 2rem);
  width: 100%;
  margin: auto;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
  padding-bottom: 3rem;

  @include sm {
    padding-left: 0;
    padding-right: 0;
    width: 90%;
    min-height: calc(100vh - ($navbar-height));
    padding-top: calc($navbar-height + 2rem);
  }
  @include xl {
    width: 90%;
  }
  @include xxl {
    width: 80%;
  }
  @include xxxl {
    width: 75%;
  }
}
</style>
