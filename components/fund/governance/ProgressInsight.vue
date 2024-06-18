<template>
  <div class="progress-insight">
    <v-card class="progress-insight__card">
      <h3 v-if="title" class="progress-insight__title">
        {{ title }}
      </h3>
      <v-progress-linear
        :height="height"
        :model-value="progress"
        class="progress-insight__progress-bar"
      />
      <div class="progress-insight__progress-text">
        {{ parsedProgressText }}
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    progress: {
      type: Number,
      default: 0,
    },
    height: {
      type: String,
      default: "16",
    },
    title: {
      type: String,
      default: "",
    },
    subtext: {
      type: String,
      default: "",
    },
  },
  computed: {
    parsedProgressText(): string {
      // Ensure the number is between 0 and 100
      const limitedValue = Math.max(0, Math.min(100, this.progress)).toFixed(0);

      return limitedValue ? `${limitedValue}% ${this.subtext}` : "";
    },
  },
};
</script>

<style scoped lang="scss">
.progress-insight {
  // v-progress overrides
  &__progress-bar {
    border-radius: 0.3rem;
    color: $color-primary;

    :deep(.v-progress-linear__background) {
      background-color: $color-steel-blue;
      opacity: 1;
    }
  }
  &__card {
    padding: 1rem;
    background-color: $color-gray-light-transparent;
    @include borderGray;

    box-shadow: 0px 0px 16px 0px $color-box-shadow;
  }
  &__title {
    padding: 0;
    margin-bottom: 0.8rem;

    font-size: 14px;
    line-height: 1;
    font-weight: 500;
    color: $color-white;
  }
  &__progress-bar {
    margin-bottom: 0.8rem;
  }
  &__progress-text {
    font-weight: 500;
    font-size: 13px;
    line-height: 1;
    letter-spacing: 0.03em;
    color: $color-steel-blue;
  }
}
</style>
