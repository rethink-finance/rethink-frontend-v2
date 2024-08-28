<template>
  <div>
    <v-dialog
      :model-value="modelValue"
      scrim="black"
      opacity="0.3"
      max-width="600"
      @update:model-value="closeDelegateDialog"
    >
      <div class="main_card di_card">
        <div class="di_card__header-container">
          <div class="di_card__header">
            <Icon
              icon="material-symbols:info-outline"
              class="di_card__info-icon"
              width="1.5rem"
            />
            {{ title }}
          </div>

          <Icon
            icon="material-symbols:close"
            class="di_card__close-icon"
            width="1.5rem"
            @click="closeDelegateDialog()"
          />
        </div>

        <div class="di_card__content">
          <div class="di_card__text" v-html="message"></div>

          <div class="di_card__button-container">
            <v-btn
              class="di_card__submit-button"
              variant="text"
              color="white"
              @click="closeDelegateDialog()"
            >
              Cancel
            </v-btn>

            <v-btn
              class="di_card__submit-button"
              color="primary"
              @click="confirm()"
            >
              {{ confirmText }}
            </v-btn>
          </div>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
defineProps({
  modelValue: Boolean,
  message: String,
  title: String,
  confirmText: String,
});
const emit = defineEmits(["update:modelValue", "confirm"]);

const closeDelegateDialog = () => {
  emit("update:modelValue", false);
};

const confirm = () => {
  emit("update:modelValue", false);
  emit("confirm");
};
</script>

<style scoped lang="scss">
.di_card {
  margin: 0 auto;
  padding-bottom: 2rem;
  width: 100%;
  max-width: 500px;
  color: white;

  @include borderGray;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  &__header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: $text-lg;
    font-weight: 700;
  }
  &__info-icon {
    color: $color-primary;
    rotate: 180deg;
  }
  &__close-icon {
    cursor: pointer;
    color: $color-steel-blue;
  }
  &__content {
    margin-top: 2rem;
  }
  &__text {
    margin-bottom: 2rem;
    font-size: $text-md;
    font-weight: 500;
    color: $color-light-subtitle;
  }
  &__button-container {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
}
</style>
