<template>
  <v-snackbar
    v-for="toast in toasts"
    :key="toast.id"
    :model-value="true"
    :timeout="toast.duration"
    :class="['toast', backgroundClass(toast.level), 'text'+textColorClass(toast.level)]"
    multi-line
  >
    <div class="toast_content">
        <Icon
          v-if="toastIcon(toast.level)"
          :icon="toastIcon(toast.level)"
          width="1.5rem"
          class="icon__toast"
        />

      {{ toast.message }}
    </div>

    <template #actions>
      <v-btn
        :class="['btn-close', 'btn-close'+textColorClass(toast.level)]"
        icon
        @click="toastStore.closeToast(toast.id)"
      >
        <Icon
          icon="octicon:x-16"
          width="1.5rem"
          class="icon"
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
    success: "toast-success",
    warning: "toast-warning ",
    error: "toast-danger",
  };

  // Return the corresponding class for the given level
  return levelClasses[level] || "";
};

const toastIcon = (level) => {
  // Define your mapping of levels to icons
  const levelIcons = {
    success: "material-symbols:check-circle-outline",
    warning: "material-symbols:warning-outline",
    error: "material-symbols:error-outline",
  };

  // Return the corresponding icon for the given level
  return levelIcons[level] || "";
};

const textColorClass = (level) => {
  // Set text color to white for levels other than info
  return level && level !== "info" ? "-white" : "";
};
</script>

<style lang="scss" scoped>
:deep(.v-overlay__content.v-snackbar__wrapper){
  background-color: #111C35;
  color: $color-white;

  box-shadow: 0px 0px 16px 0px $color-box-shadow;
}

.toast_content {
  display: flex;
  align-items: center;
  gap: 14px;
}
.toast-success {
  .icon__toast {
    color: #38DE38;
  }
}
.toast-danger {
  .icon__toast {
    color: #DE3838;
  }
}
.toast-warning {
  .icon__toast {
    color: #FB8C00;
  }
}

:deep(.v-overlay__content.v-snackbar__wrapper) {
  .v-snackbar__content {
    font-weight: 500;
    line-height: 150%;
  }
}
:deep(.v-btn){
  color: #AEC5FF !important;
  height: 2.5rem !important;
  width: 2.5rem !important;
  padding: 0 !important;
}
</style>
