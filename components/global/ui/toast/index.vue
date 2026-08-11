<template>
  <Teleport to="body">
    <TransitionGroup
      name="toast"
      tag="div"
      class="toasts"
      role="region"
      aria-label="Notifications"
    >
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.level || 'info'}`"
        :role="toast.level === 'error' ? 'alert' : 'status'"
        @mouseenter="toastStore.pauseToast(toast.id)"
        @mouseleave="toastStore.resumeToast(toast.id)"
      >
        <Icon
          :icon="toastIcon(toast.level)"
          width="1.125rem"
          class="toast__icon"
        />

        <div class="toast__message">
          <div class="toast__eyebrow">
            {{ toastLabel(toast.level) }}
          </div>
          {{ toast.message }}
        </div>

        <button
          type="button"
          class="toast__close"
          aria-label="Dismiss"
          @click="toastStore.closeToast(toast.id)"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { useToastStore } from "~/store/toasts/toast.store";

/**
 * The notification stack.
 *
 * Built as one owned column rather than as N Vuetify snackbars: a snackbar
 * positions itself, so several open at once all claimed the same spot at the
 * bottom of the screen and overlapped into an unreadable pile. One container
 * that lays its children out means a second toast can only ever sit above the
 * first.
 *
 * Teleported to the body so no ancestor's overflow, transform or stacking
 * context can clip it. Scoped styles still apply — Vue tags teleported nodes
 * with the component's scope id.
 */
const toastStore = useToastStore();

const toastIcon = (level) => {
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
/**
 * Anchored bottom-right and growing upward, so the newest toast is always in
 * the same place and older ones move rather than being covered. Above dialogs
 * (2400) because a toast often reports the outcome of what a dialog just did.
 */
.toasts {
  position: fixed;
  z-index: 2500;
  right: 1.5rem;
  bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: min(26rem, calc(100vw - 3rem));
  /* The column is only a layout box; clicks belong to the toasts in it. */
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  /* Floating panel: one step brighter than the page, over a neutral shadow —
     the same treatment as every other overlay (see overlays.scss). */
  background: $color-navy-gray-light;
  border: 1px solid $color-line-2;
  border-left-width: 2px;
  border-left-color: $color-line-3;
  border-radius: $default-border-radius;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  font-size: $text-sm;
  font-weight: 500;
  line-height: 1.5;
  color: $color-white;

  &__icon {
    flex: none;
    width: 1.125rem;
    height: 1.125rem;
    margin-top: 0.125rem;
    color: $color-steel-blue;
  }

  &__message {
    min-width: 0;
    /* Long messages wrap and the panel grows; nothing is cut off. */
    overflow-wrap: anywhere;
  }

  &__eyebrow {
    margin-bottom: 0.125rem;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__close {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    margin: -0.25rem -0.25rem 0 0;
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

  /* The icon and the leading rule take the level's hue; the message stays
     white so it is read as information rather than as a colour. */
  &--success {
    border-left-color: $color-success-light;

    .toast__icon {
      color: $color-success-light;
    }
  }

  &--warning {
    border-left-color: $color-warn;

    .toast__icon {
      color: $color-warn;
    }
  }

  &--error {
    border-left-color: $color-neg;

    .toast__icon {
      color: $color-neg;
    }
  }
}

/* Entering from the right edge it is anchored to; leaving straight out again.
   The move transition is what keeps the stack from jumping when one in the
   middle is dismissed. */
.toast-enter-active,
.toast-leave-active,
.toast-move {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(0.75rem);
}

/* Taken out of flow on the way out so the toasts above it close the gap
   instead of waiting for it to finish.

   It also stops taking clicks the moment it is dismissed — both because a
   toast on its way out should not be clickable, and because the leave has no
   guaranteed end: Vue advances it on a requestAnimationFrame, which the
   browser pauses while the page is hidden. Dismiss a toast, switch tabs, and
   the element can sit there until the page is looked at again; without this
   it would be an invisible panel eating clicks in the corner. */
.toast-leave-active {
  position: absolute;
  right: 0;
  left: 0;
  pointer-events: none;
}

@media (max-width: 600px) {
  .toasts {
    right: 1rem;
    left: 1rem;
    bottom: 1rem;
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: none;
  }
}
</style>
