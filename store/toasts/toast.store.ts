import { defineStore } from "pinia";
import type IToast from "~/types/ui/toast";

/**
 * The stack never grows past this. Anything that can fire one toast can fire
 * six — a failing batch reports per item — and a column tall enough to cover
 * the page is worse than losing the oldest line of a story the newest line
 * already tells.
 */
const MAX_VISIBLE = 4;

/**
 * Dismissal timers, keyed by toast id. Outside the store state because they
 * are not data: nothing renders them, and a Pinia-reactive timer handle only
 * invites something to await it.
 */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

let nextId = 0;

const clearTimer = (id: number) => {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
};

export const useToastStore = defineStore({
  id: "toast",
  state: () => ({
    toasts: [] as IToast[],
  }),

  actions: {
    /**
     * @param duration Milliseconds on screen. Pass -1 to keep it until the
     *   reader dismisses it — for anything they have to act on.
     */
    addToast(message: string, level?: string, duration: number = 5000): void {
      // The same message arriving again is the same news, so it moves to the
      // bottom of the stack with a fresh timer rather than being repeated.
      const existingToast = this.toasts.find(
        (toast) => toast.message === message,
      );
      if (existingToast) {
        this.closeToast(existingToast.id);
      }

      // A monotonic counter, not Date.now(): two toasts raised in the same
      // millisecond would share an id, and dismissing either would take both.
      const id = ++nextId;
      this.toasts.push({ id, message, level, duration });

      while (this.toasts.length > MAX_VISIBLE) {
        this.closeToast(this.toasts[0].id);
      }

      // Timers belong here rather than in the component: a toast raised by an
      // action should expire on its own schedule whether or not anything is
      // mounted to watch it.
      if (import.meta.client && duration > 0) {
        timers.set(
          id,
          setTimeout(() => this.closeToast(id), duration),
        );
      }
    },
    successToast(message: string, duration?: number) {
      this.addToast(message, "success", duration);
    },
    warningToast(message: string, duration?: number) {
      this.addToast(message, "warning", duration);
    },
    errorToast(message: string, duration?: number) {
      if (!duration) {
        duration = 6000;
      }
      this.addToast(message, "error", duration);
    },
    closeToast(id: number): void {
      clearTimer(id);
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    },
    /** Hold the stack open while the reader is over it — see the component. */
    pauseToast(id: number): void {
      clearTimer(id);
    },
    resumeToast(id: number): void {
      const toast = this.toasts.find((item) => item.id === id);
      if (!toast || timers.has(id)) return;

      // Restarting from the full duration rather than resuming a remainder:
      // whatever was left when the pointer arrived is not enough time to read
      // the message they just moved to read.
      const duration = toast.duration ?? 5000;
      if (import.meta.client && duration > 0) {
        timers.set(
          id,
          setTimeout(() => this.closeToast(id), duration),
        );
      }
    },
  },
});
