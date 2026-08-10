<template>
  <v-snackbar
    v-for="toast in toasts"
    :key="toast.id"
    :model-value="true"
    :timeout="toast.duration"
    :class="['toast', backgroundClass(toast.level)]"
    multi-line
  >
    <div class="toast_content">
      <Icon
        :icon="toastIcon(toast.level)"
        width="1.125rem"
        class="icon__toast"
      />

      <div class="message">
        <div class="message__eyebrow">
          {{ toastLabel(toast.level) }}
        </div>
        {{ toast.message }}
      </div>
    </div>

    <template #actions>
      <button
        type="button"
        class="btn-close"
        aria-label="Dismiss"
        @click="toastStore.closeToast(toast.id)"
      >
        <Icon icon="material-symbols:close" width="1.125rem" />
      </button>
    </template>
  </v-snackbar>
</template>

<script setup>
import { useToastStore } from "~/store/toasts/toast.store";
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

  // An info toast still gets a mark, so every toast reads the same shape and
  // only the hue distinguishes them.
  return levelIcons[level] || "material-symbols:info-outline";
};

/* The mono eyebrow above the message — the level named in words rather than
   carried only by colour. */
const toastLabel = (level) => {
  const levelLabels = {
    success: "Success",
    warning: "Warning",
    error: "Error",
  };

  return levelLabels[level] || "Notice";
};
</script>

<style lang="scss" scoped>
/* The panel itself — surface, hairline and the level rule down the leading
   edge — is in assets/scss/overlays.scss: the snackbar teleports out of this
   component, so its wrapper cannot be reached from a scoped block. */

.toast_content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;

  .icon__toast {
    flex: none;
    width: 1.125rem;
    height: 1.125rem;
    margin-top: 0.125rem;
    color: $color-steel-blue;
  }

  .message {
    min-width: 0;
    flex: 1 1 auto;

    &__eyebrow {
      margin-bottom: 0.125rem;
      font-family: $font-mono;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }
  }
}

/* The icon takes the level's hue; the message stays white so it is read as
   information rather than as a colour. */
.toast-success .icon__toast {
  color: $color-success-light;
}
.toast-danger .icon__toast {
  color: $color-neg;
}
.toast-warning .icon__toast {
  color: $color-warn;
}

.btn-close {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: $default-border-radius;
  color: $color-steel-blue;
  cursor: pointer;
  transition: background-color $default-transition-time ease,
    color $default-transition-time ease;

  &:hover {
    background: $color-gray-light-transparent;
    color: $color-white;
  }
}
</style>
