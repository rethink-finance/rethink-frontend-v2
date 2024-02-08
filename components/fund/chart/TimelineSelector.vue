<template>
  <div class="timeline_selector">
    <div class="timeline_selector__select_button" @click="toggleMenuOpen">
      <div>
        <div class="timeline_selector__selected">
          {{ selectedTimeline }}
          <Icon name="IconDropdownArrow" size="2rem" :class="{'active': menuOpen}" />
        </div>
      </div>
    </div>
    <div class="timeline_selector__buttons" :class="{'timeline_selector__buttons--open': menuOpen}">
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
      menuOpen: false,
      selectedTimeline: this.selected,
      timelineOptions,
    }
  },
  methods: {
    selectTimeline(option: string) {
      this.selectedTimeline = option;
      this.$emit("change", option);
      this.menuOpen = false;
    },
    toggleMenuOpen() {
      this.menuOpen = !this.menuOpen;
    },
  },
};
</script>

<style lang="scss" scoped>
.timeline_selector {
  @include borderGray("border");
  @include sm {
    border: none;
  }
  position: relative;

  &__select_button {
    height: 100%;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    font-weight: bold;
    justify-content: center;
    display: flex;
    flex-direction: column;

    @include sm {
      display: none;
    }
    &:hover {
      background: $color-hover;
      cursor: pointer;
    }
  }
  &__buttons {
    flex-direction: column;
    display: none;
    &--open {
      position: absolute;
      margin-top: 0.5rem;
      top: 100%;
      left: 0;
      z-index: 20;
      width: 100%;
      display: flex;
    }
    @include sm {
      display: flex;
      max-width: fit-content;
      justify-content: flex-start;
      gap: 0.5rem;
      flex-direction: row;
    }
  }
  &__button {
    width: 100%;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: $text-md !important;
    min-width: 2.5rem !important;
    height: 3rem !important;
    color: white !important;
    justify-content: flex-start;
    align-content: center;
    background: $color-dark;
    font-weight: 500 !important;
    @include borderGray("border");

    @include sm {
      width: 2.5rem;
      height: 2.5rem !important;
      padding: 0.5rem;
      justify-content: center;
    }

    &.button-active {
      font-weight: bold !important;
      background-color: $color-navy-gray-light;
      color: $color-primary !important;
    }
  }
}
</style>
