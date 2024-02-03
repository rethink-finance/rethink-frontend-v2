<template>
  <img
    src="/logo.svg"
    class="rethink_logo"
  >
  <img
    src="@/assets/images/logo_mobile.svg"
    class="rethink_logo_mobile"
  >
</template>
<style lang="scss" scoped>
.rethink_logo {
  display: none;
  align-self: center;

  @include sm {
    width: 92px;
    display: block;
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
