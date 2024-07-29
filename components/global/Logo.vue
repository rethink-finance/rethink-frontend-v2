<template>
  <span>
    <img
      src="/logo.svg"
      class="rethink_logo"
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
