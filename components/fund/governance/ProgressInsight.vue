<template>
  <div class="progress-insight">
    <v-card class="progress-insight__card">
      <h3 v-if="title" class="progress-insight__title">
        {{ title }}
      </h3>
      <v-tooltip activator="parent" location="bottom" :disabled="!tooltipText">
        <template #activator="{ props }">
          <v-progress-linear
            v-bind="props"
            :height="height"
            :model-value="value"
            :max="max"
            class="progress-insight__progress-bar"
          />
        </template>
        <template #default>
          {{ tooltipText }}
        </template>
      </v-tooltip>

      <div class="progress-insight__progress-text">
        {{ parsedProgressText }}
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    value: {
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
    tooltipText: {
      type: String,
      default: "",
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 1,
    },
    formatFunction: {
      type: Function,
      default: (value: any) => value,
    },
  },
  computed: {
    parsedProgressText(): string {
      // Ensure the number is between 0 and 100
      const limitedValue = Math.max(this.min, Math.min(this.max, this.value));
      console.log(limitedValue);
      return limitedValue ? `${this.formatFunction(this.value)} ${this.subtext}` : "";
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
    box-shadow: 0 0 1rem 0 $color-box-shadow;
  }
  &__title {
    padding: 0;
    margin-bottom: 0.8rem;
    font-size: $text-sm;
    line-height: 1;
    font-weight: 500;
    color: $color-white;
  }
  &__progress-bar {
    margin-bottom: 0.8rem;
  }
  &__progress-text {
    font-weight: 500;
    font-size: $text-sm;
    line-height: 1;
    letter-spacing: 0.03em;
    color: $color-steel-blue;
  }
}
</style>
