<template>
  <div class="fund_name">
    <v-avatar size="4.5rem" :rounded="false" class="fund_name__avatar">
      <img cover :src="props.image">
    </v-avatar>
    <div class="title_wrapper">
      <h4 class="text-white">
        {{ title }}
      </h4>

      <div v-if="strategistName" class="strategist_url">
        <h5>by {{ strategistName }}</h5>
      </div>
      <div v-else-if="subtitle" class="strategist_url">
        <h5>{{ truncatedSubtitle }}</h5>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  image: {
    type: String,
    default: "",
  },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  strategistName: { type: String, default: "" },
  strategistUrl: { type: String, default: "" },
});

const truncatedSubtitle = computed(() => {
  const maxLen = 80;
  if (props.subtitle.length <= maxLen) {
    return props.subtitle;
  }
  return props.subtitle.substring(0, maxLen) + "...";
});
</script>

<style lang="scss" scoped>
.fund_name {
  display: flex;
  flex-direction: row;
  padding-block: 0.25rem;

  &__avatar {
    border-radius: 0;
    margin-right: 0.75rem;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
.title_wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  //justify-content: space-around;
  gap: 0.125rem;
  flex-grow: 1; /* Allow the title wrapper to fill available space */
  min-width: 0; /* Prevents flex items from growing past their content size */

  h4,
  h5 {
    @include ellipsis;
    width: 100%;
  }
  h4 {
    font-size: 0.875rem;
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.0525rem;
    max-width: 100%;
  }

  h5 {
    max-width: 100%;
    font-size: 0.875rem;
    font-style: normal;
    font-weight: 500;
    letter-spacing: 0.02625rem;
    color: $color-light-subtitle;
    transition: color 0.2s ease;
  }
}

.strategist_url {
  max-width: 100%;
}
</style>
