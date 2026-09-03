<template>
  <span>
    <!-- Two wordmark variants, same artwork at the same size: the standard
         mark's "rethink" text is filled white and the light one's is filled
         ink. Which renders is decided by the [data-theme] rules in app.scss —
         an <img> SVG can't be recolored from CSS. The mobile glyph is the
         gradient mark alone and works on both grounds. -->
    <img
      :src="logo"
      class="rethink_logo theme_logo--dark"
      :class="{'rethink_logo--sm': small}"
    >
    <img
      :src="logoLight"
      class="rethink_logo theme_logo--light"
      :class="{'rethink_logo--sm': small}"
    >
    <img
      src="@/assets/images/logo_mobile.svg"
      class="rethink_logo_mobile"
      :class="{'rethink_logo_mobile--sm': small}"
    >
  </span>
</template>
<script setup lang="ts">
// Inlined as data URIs rather than requested: the browser holds image
// requests back while script requests are in flight, and on the dev server
// that is hundreds of module requests — the navbar drew around an empty box
// for seconds. The mobile mark is small enough that Vite inlines it on its
// own; these two are 10 KB each and have to be asked for.
import logo from "@/assets/images/logo.svg?inline";
import logoLight from "@/assets/images/logo_light.svg?inline";

defineProps({
  small: {
    type: Boolean,
    default: false,
  },
});
</script>
<style lang="scss" scoped>
.rethink_logo {
  display: none;
  align-self: center;


  @include sm {
    width: 92px;
    display: block;
    &--sm {
      width: 68px;
    }
  }
}
.rethink_logo_mobile {
  display: block;
  align-self: center;
  width: 1.5rem;
  height: 1.5rem;

  @include sm {
    display: none;
  }
}
</style>
