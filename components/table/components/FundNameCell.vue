<template>
  <div class="fund_name">
    <v-avatar size="2rem" rounded="0" class="fund_name__avatar">
      <img
        cover
        :src="props.image"
      >
    </v-avatar>
    <div class="d-flex align-items-center">
      <div class="title-wrapper">
        <h4>{{ title }}</h4>
        <h5>{{ subtitle }}</h5>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  image: {
    type: String,
    default: "https://api.lorem.space/image/finance?w=150&h=150",
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
    border-radius: 0.25rem;
    margin-right: 0.75rem;
    img {
      width: 2rem;
      height: 2rem;
    }
  }
}
.title-wrapper {
  justify-content: center;
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
</style>
