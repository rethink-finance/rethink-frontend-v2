<template>
  <div class="fund_name">
    <v-avatar size="52" class="fund_name__avatar">
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
  return props.subtitle;
  // return props.subtitle.substring(0, maxLen) + "...";
});
</script>

<style lang="scss" scoped>
/* Design-file vault cell: 44px rounded logo tile, tight two-line text */
.fund_name {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-block: 0.25rem;

  &__avatar {
    width: 52px !important;
    height: 52px !important;
    /* Same corner radius as the table card */
    border-radius: $default-border-radius !important;
    overflow: hidden;
    margin-right: 0.875rem;
    border: 1px solid $color-line;
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
  gap: 0.1875rem;
  flex-grow: 1; /* Allow the title wrapper to fill available space */
  min-width: 0; /* Prevents flex items from growing past their content size */

  h4,
  h5 {
    @include ellipsis;
    width: 100%;
  }
  h4 {
    font-size: 14.5px;
    font-style: normal;
    font-weight: 700;
    letter-spacing: normal;
    max-width: 100%;
  }

  h5 {
    max-width: 100%;
    font-size: 12.5px;
    font-style: normal;
    font-weight: 500;
    letter-spacing: normal;
    color: $color-steel-blue;
    transition: color 0.2s ease;
  }
}

.strategist_url {
  max-width: 100%;

  /* Description can wrap onto two lines before truncating.
     Capped width so lines break earlier and stay easy to scan. */
  h5 {
    white-space: normal;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
    line-height: 1.45;
    max-width: 28ch;
  }
}
</style>
