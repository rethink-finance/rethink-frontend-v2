<template>
  <span>
    <div
      class="soonami_logo"
      :class="{'soonami_logo--sm': small}"
    >
      soonami.io
    </div>
    <div
      class="soonami_logo_mobile"
      :class="{'soonami_logo_mobile--sm': small}"
    >
      soonami.io
    </div>
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
.soonami_logo {
  display: none;
  align-self: center;
  letter-spacing: -1px;
  background-image: url(https://cdn.prod.website-files.com/6232b6a…/63bc8d4…_soonami%20text.png);
  background-position: 0 0;
  background-size: auto;
  background-attachment: fixed;
  font-family: Outfit, sans-serif;
  font-size: 36px;
  font-weight: 700;
  line-height: 42px;
  color: white;

  @include sm {
    width: 92px;
    display: block;
    &--sm {
      width: 68px;
    }
  }
}
.soonami_logo_mobile {
  display: block;
  align-self: center;
  width: 1.5rem;
  height: 1.5rem;

  @include sm {
    display: none;
  }
}
</style>
