<template>
  <div class="price_type_selector">
    <div
      class="price_type_selector__select_button"
      :class="{ 'price_type_selector__select_button--hover': hasMultipleTypeOptions }"
      @click="toggleMenuOpen"
    >
      <div>
        <div class="price_type_selector__price">
          <v-progress-circular
            v-if="isLoading"
            class="d-flex"
            size="20"
            width="3"
            indeterminate
          />
          <span v-else>{{ value }}</span>
        </div>
        <div class="price_type_selector__selected">
          {{ selectedTypeValue }}
        </div>
      </div>
      <IconDropdown v-if="hasMultipleTypeOptions" :active="menuOpen" />
    </div>
    <div v-if="menuOpen" class="price_type_selector__options">
      <div
        v-for="(option) in typeOptions"
        :key="option.key"
        class="price_type_selector__option"
        :class="{ 'option-active': selected === option.key }"
        @click="selectType(option)"
      >
        {{ option.value }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChartTypesMap, type ChartType, type IChartType } from "~/types/enums/chart_type";


const props = defineProps<{
  value: string;
  selected: ChartType;
  typeOptions: Record<ChartType, IChartType>;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "update:selected", value: string): void;
}>();

const menuOpen = ref(false);


const selectedTypeValue = computed(() => ChartTypesMap[props.selected].value);
const hasMultipleTypeOptions = computed(() => Object.keys(props.typeOptions).length > 1);

const selectType = (option: IChartType) => {

  emit("update:selected", option.key);
  menuOpen.value = false;
};

const toggleMenuOpen = () => {
  if (!hasMultipleTypeOptions.value) return;
  menuOpen.value = !menuOpen.value;
};
</script>

<style lang="scss" scoped>
.price_type_selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 500;
  min-width: 10rem;
  @include borderGray("border");
  position: relative;

  &__select_button {
    display: flex;
    flex-direction: row;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
    justify-content: space-between;
    align-items: center;

    &--hover:hover {
      background: $color-hover;
      cursor: pointer;
    }
  }
  &__price {
    font-size: $text-md;
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
