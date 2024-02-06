<template>
  <v-snackbar
    v-for="toast in toasts"
    :key="toast.id"
    v-model="show"
    :timeout="toast.duration"
    :class="[backgroundClass(toast.level), 'text'+textColorClass(toast.level)]"
    multi-line
  >
    {{ toast.message }}

    <template #actions>
      <v-btn
        variant="text"
        :class="['btn-close'+textColorClass(toast.level)]"
        @click="toastStore.closeToast(toast.id)"
      >
        Close
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
const show = ref(true);
</script>

<style lang="scss" scoped>
.bg-success,
.bg-warning,
.bg-danger {
  .toast-body {
    font-weight: bold;
  }
}

.toast {
  width: max-content;
  max-width: 440px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>
