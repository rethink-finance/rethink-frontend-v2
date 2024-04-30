<template>
  <div class="price_type_selector">
    <div class="price_type_selector__select_button" @click="toggleMenuOpen">
      <div>
        <div class="price_type_selector__price">
          $1,612.72
        </div>
        <div class="price_type_selector__selected">
          {{ selectedTypeValue }}
        </div>
      </div>
      <IconDropdown :active="menuOpen" />
    </div>
    <div v-if="menuOpen" class="price_type_selector__options">
      <div
        v-for="(optionValue, optionKey) in typeOptions"
        :key="optionKey"
        class="price_type_selector__option"
        :class="{ 'option-active': selectedType === optionKey }"
        @click="selectType(optionKey)"
      >
        {{ optionValue }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const typeOptions: Record<string, string> = {
  "sharePrice": "Share Price",
  "aum": "AUM",
};

export default {
  name: "TypeSelector",
  props: {
    selected: {
      type: String,
      default: "sharePrice",
      rules: [
        (value: string) => {
          if (!Object.keys(typeOptions)?.includes(value)) {
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
      selectedType: this.selected,
      menuOpen: false,
      typeOptions,
    }
  },
  computed: {
    selectedTypeValue() {
      return this.typeOptions[this.selectedType];
    },
  },
  methods: {
    selectType(option: string) {
      this.selectedType = option;
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
.price_type_selector {
  width: 10rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 500;
  @include borderGray("border");
  position: relative;

  &__select_button {
    display: flex;
    flex-direction: row;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
    justify-content: space-between;
    align-items: center;

    &:hover {
      background: $color-hover;
      cursor: pointer;
    }
  }
  &__price {
    font-size: $text-lg;
  }
  &__selected {
    font-size: $text-sm;
    color: $color-light-subtitle;
  }

  &__options {
    display: flex;
    flex-direction: column;
    @include borderGray("border");
    position: absolute;
    margin-top: 0.5rem;
    top: 100%;
    left: 0;
    z-index: 20;
    width: 100%;
  }

  &__option {
    padding: 0.75rem 1rem;
    cursor: pointer;
    color: white;
    background: $color-dark;
    align-content: center;
    height: 3rem;

    @include sm {
      padding: 0.5rem 1rem;
      height: 2.5rem;
    }

    &.option-active {
      background-color: $color-navy-gray-light;
      color: $color-primary;
      font-weight: 700;
    }
    &:not(.option-active):hover {
      background: $color-hover;
    }
  }
}
</style>
