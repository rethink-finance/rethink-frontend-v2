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
/* The page column. The navbar's inner row and the footer's inner row use the
   same container, so a page's left edge lands under the navbar logo and its
   right edge under the settings button. Vertical rhythm stays here — the
   mixin only sets the horizontal box. */
main {
  @include page-container;
  padding-top: calc($navbar-height + 2rem);
  padding-bottom: 3rem;

  @include sm {
    min-height: calc(100vh - ($navbar-height));
  }
}
</style>
