<template>
  <div class="fund_name">
    <v-avatar size="3rem" :rounded="true" class="fund_name__avatar">
      <img
        cover
        :src="props.image"
      >
    </v-avatar>
    <div class="title_wrapper">
      <h4>{{ title }}</h4>
      <h5>{{ subtitle }}</h5>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  image: {
    type: String,
    default: "",
  },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
});
</script>

<style lang="scss" scoped>
.fund_name {
  display: flex;
  flex-direction: row;

  &__avatar {
    border-radius: 50%;
    margin-right: 0.75rem;
    img {
      width: 100%;
      height: 100%;
    }
  }
}
.title_wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 0.25rem;
  flex-grow: 1; /* Allow the title wrapper to fill available space */
  min-width: 0; /* Prevents flex items from growing past their content size */

  h4, h5 {
    @include ellipsis;
    width: 100%;
  }
  h4 {
    font-size: 0.875rem;
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.0525rem;
    line-height: 1; /* 1.3125rem */
    text-transform: uppercase;
  }

  h5 {
    font-size: 0.875rem;
    font-style: normal;
    font-weight: 500;
    line-height: 1; /* 1.3125rem */
    letter-spacing: 0.02625rem;
    color: $color-light-subtitle;
  }
}

</style>
