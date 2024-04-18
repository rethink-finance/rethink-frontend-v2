import { defineStore } from "pinia";
import type IToast from "~/types/ui/toast";


export const useToastStore = defineStore({
  id: "toast",
  state: () => ({
    toasts: [] as IToast[],
  }),

  actions: {
    addToast(message: string, level?: string, duration: number=4000): void {
      /**
       * @param {number} duration -
       * Time (in milliseconds) to wait until snackbar is automatically hidden.
       * Use -1 to keep open indefinitely (0 in version < 2.3 ).
       * It is recommended for this number to be between 4000 and 10000.
       * Changes to this property will reset the timeout.
       */
      // Check if a toast with the same message already exists
      const existingToast = this.toasts.find((toast) => toast.message === message);

      if (existingToast) {
        // If found, close the existing toast
        this.closeToast(existingToast.id);
      }
      console.log("toast");
      console.log(duration);
      const id = Date.now();
      this.toasts.push({ id, message, level, duration });
      console.log(this.toasts)
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
      this.toasts = this.toasts.filter(
        (toast) => toast.id !== id,
      );
    },
  },
});
