<template>
  <div class="timeline_selector">
    <v-btn
      v-for="option in timelineOptions"
      :key="option"
      variant="outlined"
      size="small"
      class="timeline_selector__button"
      :class="{ 'button-active': selectedTimeline === option }"
      @click="selectTimeline(option)"
    >
      {{ option }}
    </v-btn>
  </div>
</template>

<script lang="ts">
const timelineOptions = ["1M", "3M", "6M", "1Y", "ALL"];

export default {
  name: "TimelineSelector",
  props: {
    selected: {
      type: String,
      default: "3M",
      rules: [
        (value: string) => {
          if (!timelineOptions?.includes(value)) {
            return `Selected value is not supported: ${value}`
          }

          return true;
        },
      ],
    },
  },
  emits: ["change"],
  data() {
    return {
      selectedTimeline: this.selected,
      timelineOptions,
    }
  },
  methods: {
    selectTimeline(option: string) {
      this.selectedTimeline = option;
      this.$emit("change", option);
    },
  },
};
</script>

<style lang="scss" scoped>
.timeline_selector {
  max-width: fit-content;
  display: flex;
  justify-content: flex-start;
  gap: 0.5rem;

  &__button {
    height: 2.5rem !important;
    width: 2.5rem !important;
    min-width: 2.5rem !important;
    padding: 0.5rem;
    cursor: pointer;
    color: white !important;
    @include borderGray("border");

    &.button-active {
      background-color: $color-navy-gray-light;
      color: $color-primary !important;
    }
  }
}
</style>
