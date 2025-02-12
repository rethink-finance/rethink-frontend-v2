import { defineStore } from "pinia";
import { ActionState } from "~/types/enums/action_state";

export const useActionStateStore = defineStore("actionState", {
  state: () => ({
    loadingStates: {} as Record<string, ActionState>,
  }),

  getters: {
    isActionState: (state) => {
      return (key: string, stateToCheck: ActionState): boolean => {
        return state.loadingStates[key] === stateToCheck;
      };
    },
    isActionStateLoading: (state) => {
      return (key: string): boolean => {
        return state.loadingStates[key] === ActionState.Loading;
      };
    },
    getActionState: (state) => {
      return (key: string): ActionState | undefined => {
        return state.loadingStates[key];
      };
    },
  },

  actions: {
    setActionState(actionName: string, state: ActionState) {
      this.loadingStates[actionName] = state;
    },
  },
});

export async function useActionState(
  actionName: string,
  action: () => Promise<any>,
  restricted: boolean = false,
): Promise<any> {
  const actionStateStore = useActionStateStore();
  if (restricted && actionStateStore.isActionState(actionName, ActionState.Loading)) {
    console.warn(`Action "${actionName}" is already in progress.`);
    return;
  }
  actionStateStore.setActionState(actionName, ActionState.Loading);
  try {
    const result = await action();
    actionStateStore.setActionState(actionName, ActionState.Success);
    return result;
  } catch (error) {
    console.error(`Error in action "${actionName}":`, error);
    actionStateStore.setActionState(actionName, ActionState.Error);
    throw error;
  }
}

