<template>
  <div>
    <v-dialog
      :model-value="modelValue"
      scrim="black"
      opacity="0.3"
      :max-width="maxWidth ?? '600px'"
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
          <div class="di_card__text" >
            <span v-html="message"></span>
            <slot /> <!-- This is where the content will be injected --> 
          </div>

          <div class="di_card__button-container">
            <v-btn
              class="di_card__cancel-button"
              variant="text"
              @click="cancel()"
            >
              {{ cancelText ?? "Cancel" }}
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
  cancelText: String,
  maxWidth: String,
});
const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

const closeDelegateDialog = () => {
  emit("update:modelValue", false);
};

const cancel = () => {
  emit("update:modelValue", false);
  emit("cancel");
};
const confirm = () => {
  emit("update:modelValue", false);
  emit("confirm");
};
</script>

<style scoped lang="scss">
.di_card {
  margin: 0 auto;
  padding: 40px;
  width: 100%;

  background-color: $color-bg-toast;
  box-shadow: 0px 0px 16px 0px $color-box-shadow;

  color: $color-white;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
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

  &__cancel-button {
    color: $color-text-irrelevant !important;
    font-weight: 500;
  }
}
</style>
