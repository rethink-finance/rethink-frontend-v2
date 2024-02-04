<template>
  <svg
    class="dropdown_arrow"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_2449_66779)">
      <path d="M7 10L12 15L17 10H7Z" fill="#45557F" />
    </g>
    <defs>
      <clipPath id="clip0_2449_66779">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>

<script lang="ts">
export default defineComponent({
  name: "DropdownArrow",
})
</script>

<style lang="scss" scoped>
.active {
  transform: rotate(180deg);
  path {
    fill: $color-primary !important;
  }
}
</style>
