<template>
  <span>
    <!-- Two wordmark variants, same artwork at the same size: the standard
         mark's "rethink" text is filled white and the light one's is filled
         ink. Which renders is decided by the [data-theme] rules in app.scss —
         an <img> SVG can't be recolored from CSS. The mobile glyph is the
         gradient mark alone and works on both grounds. -->
    <img
      src="@/assets/images/logo.svg"
      class="rethink_logo theme_logo--dark"
      :class="{'rethink_logo--sm': small}"
    >
    <img
      src="@/assets/images/logo_light.svg"
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
