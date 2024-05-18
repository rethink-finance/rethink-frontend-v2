<template>
  <div class="new_method">
    <div class="">
      <v-label> Position Name </v-label>
      <v-text-field
        v-model="tokenValue"
        :counter="10"
        :rules="tokenValueRules"
        hide-details
        required
      />
    </div>

    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
</template>

<script setup lang="ts">

const props = defineProps({
  modelValue: {
    type: String,
    default: "0",
  },
});

const emit = defineEmits(["update:modelValue"]);

const tokenValue = computed({
  get: () => props?.modelValue ?? "0",
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});

const tokenValueRules = [
  (value: string) => {
    const valueWei = Number(value);
    if (valueWei <= 0) return "Value must be positive."
    return true;
  },
];

</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
