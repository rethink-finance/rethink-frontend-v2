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
          name="IconClose"
          size="1.5rem"
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
    success: "bg-success",
    warning: "bg-warning ",
    error: "bg-danger",
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
.bg-success,
.bg-warning,
.bg-danger {
  .toast-body {
    font-weight: bold;
  }
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
