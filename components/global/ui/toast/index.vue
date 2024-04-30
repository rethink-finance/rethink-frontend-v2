<template>
  <v-snackbar
    v-for="toast in toasts"
    :key="toast.id"
    :model-value="true"
    :timeout="toast.duration"
    :class="[backgroundClass(toast.level), 'text'+textColorClass(toast.level)]"
    multi-line
  >
    {{ toast.message }}

    <template #actions>
      <v-btn
        :class="['btn-close'+textColorClass(toast.level)]"
        icon
        @click="toastStore.closeToast(toast.id)"
      >
        <Icon
          icon="octicon:x-16"
          width="1.5rem"
        />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import { useToastStore } from "~/store/toast.store";
const toastStore = useToastStore();
const toasts = ref(toastStore.toasts);

watch(() => toastStore.toasts, (newToasts) => {
  toasts.value = newToasts;
});

const backgroundClass = (level) => {
  // Define your mapping of levels to background classes
  const levelClasses = {
    success: "toast-bg-success",
    warning: "toast-bg-warning ",
    error: "toast-bg-danger",
  };

  // Return the corresponding class for the given level
  return levelClasses[level] || "";
};

const textColorClass = (level) => {
  // Set text color to white for levels other than info
  return level && level !== "info" ? "-white" : "";
};
</script>

<style lang="scss" scoped>
.toast-bg-success,
.toast-bg-warning,
.toast-bg-danger {
  :deep(.v-snackbar__content) {
    font-weight: bold !important;
  }
}

.toast-bg-success :deep(.v-overlay__content.v-snackbar__wrapper) {
  background: $color-success !important;
  color: $color-success-text !important;
}
.toast-bg-danger :deep(.v-overlay__content.v-snackbar__wrapper) {
  background: $color-error !important;
  color: $color-error-text !important;
}
.toast-bg-warning :deep(.v-overlay__content.v-snackbar__wrapper) {
  background: $color-warning !important;
  color: $color-warning-text !important;
}

:deep(.v-overlay__content.v-snackbar__wrapper) {
  background: $color-toast !important;
  border: 1px solid $color-secondary;

  .v-snackbar__content {
    font-weight: 500;
    line-height: 150%;
  }
}
</style>
