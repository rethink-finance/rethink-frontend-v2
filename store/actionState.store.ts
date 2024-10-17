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
  },

  actions: {
    setActionState(actionName: string, state: ActionState) {
      this.loadingStates[actionName] = state;
    },
  },
});

export async function useActionState(
  action: () => Promise<any>,
): Promise<any> {
  const actionStateStore = useActionStateStore();
  const actionName = action.name;
  actionStateStore.setActionState(actionName, ActionState.Loading);
  try {
    const result = await action();
    actionStateStore.setActionState(actionName, ActionState.Success);
    return result;
  } catch (error) {
    console.error(`Error in action "${actionName}":`, error);
    actionStateStore.setActionState(actionName, ActionState.Error);
    throw error;
  } finally {
    actionStateStore.setActionState(actionName, ActionState.Idle);
  }
}
