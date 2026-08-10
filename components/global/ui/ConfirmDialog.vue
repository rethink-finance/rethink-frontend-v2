<template>
  <v-dialog
    :model-value="modelValue"
    :max-width="maxWidth ?? '520px'"
    @update:model-value="closeDialog"
  >
    <div class="brand_modal">
      <div class="brand_modal__head">
        <div class="brand_modal__heading">
          <!-- Dialogs that want a richer heading than one line of text fill
               this in; everything else keeps the eyebrow-and-title default. -->
          <slot name="title">
            <div class="brand_modal__eyebrow">
              {{ eyebrow ?? "Confirm" }}
            </div>
            <h2 class="brand_modal__title">
              {{ title }}
            </h2>
          </slot>
        </div>

        <button
          type="button"
          class="brand_modal__close"
          aria-label="Close"
          @click="closeDialog()"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>

      <div class="brand_modal__body">
        <slot>
          {{ message }}
        </slot>
      </div>

      <div v-if="confirmText || cancelText" class="brand_modal__footer">
        <v-btn
          v-if="cancelText"
          class="di_card__cancel-button"
          variant="text"
          @click="cancel()"
        >
          {{ cancelText ?? "Cancel" }}
        </v-btn>

        <v-btn
          v-if="confirmText"
          color="primary"
          :loading="loading"
          @click="confirm()"
        >
          {{ confirmText }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps({
  modelValue: Boolean,
  message: String,
  title: String,
  eyebrow: String,
  confirmText: String,
  loading: Boolean,
  cancelText: String,
  maxWidth: String,
});
const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

const closeDialog = () => {
  emit("update:modelValue", false);
};

const cancel = () => {
  emit("update:modelValue", false);
  emit("cancel");
};
const confirm = () => {
  emit("confirm");
};
</script>

<style scoped lang="scss">
/* The dismissing action is quieter than the committing one — it is the option
   you take by not deciding. */
.di_card__cancel-button {
  color: $color-text-irrelevant !important;
  font-weight: 500;
}
</style>
