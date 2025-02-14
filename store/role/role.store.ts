// store/role.ts
import { defineStore } from "pinia";
import type {
  Role,
  Target,
  UpdateEvent,
  TargetConditions, FunctionCondition,
} from "~/types/zodiac-roles/role";
import {
  ConditionType,
  ExecutionOption,
  Level, ParameterType,
} from "~/types/enums/zodiac-roles";

// Define state interface
interface IState {
  id: string;
  activeTarget?: string;
  role?: Role;
  members: {
    list: string[];
    add: string[];
    remove: string[];
  };
  targets: {
    list: Target[];
    add: Target[];
    remove: string[];
  };
}

// Define the store
export const useRoleStore = defineStore("role", () => {
  // State
  const id = ref<string>("");
  const role = ref<Role | undefined>(undefined);
  const activeTarget = ref<string | undefined>(undefined);
  const members = ref({
    list: [] as string[],
    add: [] as string[],
    remove: [] as string[],
  });
  const targets = ref({
    list: [] as Target[],
    add: [] as Target[],
    remove: [] as string[],
  });

  // Function to initialize state
  function initRoleState(roleId: string, r?: Role) {
    console.log("Init role state", roleId, r);

    id.value = roleId;
    role.value = r;
    members.value = {
      list: r?.members.map((member) => member.address) || [],
      add: [],
      remove: [],
    };
    targets.value = {
      list: r?.targets || [],
      add: [],
      remove: [],
    };
  }

  /**
   * Getters (similar to computed properties)
   */
  const getActiveRole = computed(() => {
    return targets.value.list.find((t) => t.id === activeTarget.value) ||
      targets.value.add.find((t) => t.id === activeTarget.value);
  });

  const getTargetUpdate = computed(() => (targetId: string): UpdateEvent[] => {
    const updatedTarget = [...targets.value.list, ...targets.value.add].find((_target) => _target.id === targetId);
    if (!updatedTarget) return [];

    const originalTarget = role.value?.targets.find((_target) => _target.id === targetId);
    if (!originalTarget) {
      // Avoid creating block conditions as that's the default value
      if (updatedTarget.type === ConditionType.BLOCKED) return [];

      // If original is not found, target will be created
      const functionEvents = Object.values(updatedTarget.conditions)
        .map((funcCondition) => getFunctionUpdate(updatedTarget, funcCondition))
        .flat();

      const createEvent: UpdateEvent = {
        level: Level.SCOPE_TARGET,
        value: updatedTarget,
        old: updatedTarget,
      };

      return [createEvent, ...functionEvents];
    }

    const isClearanceUpdated = originalTarget.type !== updatedTarget.type;

    if (updatedTarget.type !== ConditionType.SCOPED) {
      /**
       * If Clearance is WILDCARDED or BLOCKED, only update clearance and execution option (if needed).
       */
      const isExecutionOptionUpdated = originalTarget.executionOption !== updatedTarget.executionOption;

      if (!isClearanceUpdated && (updatedTarget.type === ConditionType.BLOCKED || !isExecutionOptionUpdated))
        return [];

      return [{ level: Level.SCOPE_TARGET, value: updatedTarget, old: originalTarget }];
    }

    const events: UpdateEvent[] = [];

    if (isClearanceUpdated) {
      events.push({ level: Level.SCOPE_TARGET, value: updatedTarget, old: originalTarget });
    }

    const functionEvents = Object.values(updatedTarget.conditions)
      .map((funcCondition) => {
        const originalFuncCondition = originalTarget.conditions[funcCondition.sighash];
        return getFunctionUpdate(updatedTarget, funcCondition, originalFuncCondition);
      })
      .flat();

    events.push(...functionEvents);

    return events;
  });


  /**
   * Actions
   */
  // Function to determine Role ID
  function getRoleId(roleId: string, roles: Role[]): string {
    if (roleId === "new") {
      return (
        (roles
          .map((role) => BigInt(role.name)) // Convert all Role names to BigNumber
          .reduce((biggest, current) => (biggest <= current ? current : biggest), 0n) // Get the largest ID
          + 1n  // increment the biggest by 1
        ).toString()
      );
    }
    return roleId;

  }
  function handleRemoveTarget(payload: { target: Target; remove?: boolean }) {
    const { target, remove = true } = payload;

    if (activeTarget.value === target.id) {
      activeTarget.value = undefined;
    }

    if (!remove) {
      targets.value.remove = targets.value.remove.filter((_target) => _target !== target.address);
      return;
    }

    if (targets.value.add.find((_target) => _target.address === target.address)) {
      targets.value.add = targets.value.add.filter((_target) => _target.address !== target.address);
      return;
    }

    if (!targets.value.remove.includes(target.address)) {
      targets.value.remove.push(target.address);
    }
  }

  function handleAddTarget(target: Target) {
    const currentTarget =
      targets.value.add.find((_target) => target.address.toLowerCase() === _target.address.toLowerCase()) ||
      targets.value.list.find((_target) => target.address.toLowerCase() === _target.address.toLowerCase());

    if (currentTarget) {
      activeTarget.value = currentTarget.id;
      return;
    }

    activeTarget.value = target.id;
    targets.value.add.push({ ...target, address: target.address.toLowerCase() });
  }

  function handleRemoveMember(payload: { member: string; remove?: boolean }) {
    const { member, remove = true } = payload;

    if (!remove) {
      members.value.remove = members.value.remove.filter((_member) => _member !== member);
      return;
    }

    if (members.value.add.includes(member)) {
      members.value.add = members.value.add.filter((_member) => _member !== member);
      return;
    }

    if (!members.value.remove.includes(member)) {
      members.value.remove.push(member);
    }
  }

  function replaceTargetValue(targets: Target[], id: string, value: Partial<Target>): Target[] {
    return targets.map((target): Target => {
      if (target.id === id) {
        return { ...target, ...value };
      }
      return target;
    });
  }

  function handleTargetExecutionOption(payload: { targetId: string; option: ExecutionOption }) {
    const replaceValue = (targets: Target[]) =>
      replaceTargetValue(targets, payload.targetId, { executionOption: payload.option });

    if (targets.value.list.find((target) => target.id === payload.targetId)) {
      targets.value.list = replaceValue(targets.value.list);
    } else {
      targets.value.add = replaceValue(targets.value.add);
    }
  }

  function handleTargetConditions(targetId: string, conditions: TargetConditions) {
    const replaceValue = (targets: Target[]) => {
      const conditionTypes = Object.values(conditions).map((condition) => condition.type);
      //  Find the target in the state targets array
      const targetInState = targets.find((target) => target.id === targetId);

      if (!targetInState) throw new Error("Target not found in state");

      // Determine new target type based on the provided conditions.
      // If the target's type is not already WILDCARDED, it checks:
      //   - Does it have a WILDCARDED function? If yes → leave it as SCOPED.
      //   - Does it have a SCOPED function? If yes → leave it as SCOPED.
      //   - If neither is true, change the type to BLOCKED.
      let type: ConditionType = targetInState.type;
      if (type !== ConditionType.WILDCARDED) {
        const hasWildcardedFunction = conditionTypes.includes(ConditionType.WILDCARDED);
        const hasScopedFunction = conditionTypes.includes(ConditionType.SCOPED);

        type = ConditionType.SCOPED;
        if (!hasScopedFunction && !hasWildcardedFunction) {
          type = ConditionType.BLOCKED;
        }
      }

      return replaceTargetValue(targets, targetId, { type, conditions });
    };
    console.log("  handleTargetConditions targetId", targetId);
    console.log("  handleTargetConditions conditions", conditions);

    if (targets.value.list.find((target) => target.id === targetId)) {
      targets.value.list = replaceValue(targets.value.list);
    } else {
      targets.value.add = replaceValue(targets.value.add);
    }
  }

  function handleAddMember(member: string) {
    if (members.value.add.includes(member.toLowerCase()) || members.value.list.includes(member.toLowerCase())) {
      return;
    }
    members.value.add.push(member.toLowerCase());
  }

  function handleSetTargetClearance(payload: { targetId: string; option: ConditionType }) {
    const replaceOption = (target: Target): Target => {
      if (target.id !== payload.targetId) return target;
      return { ...target, executionOption: ExecutionOption.NONE, type: payload.option };
    };

    targets.value.add = targets.value.add.map(replaceOption);
    targets.value.list = targets.value.list.map(replaceOption);
  }

  function reset(newRole: Role, newId: string) {
    id.value = newId;
    role.value = newRole;
    members.value.list = newRole?.members.map((m) => m.address) || [];
    members.value.add = [];
    members.value.remove = [];
    targets.value.list = newRole?.targets || [];
    targets.value.add = [];
    targets.value.remove = [];
  }

  return {
    id,
    role,
    activeTarget,
    members,
    targets,
    getActiveRole,
    getTargetUpdate,
    getRoleId,
    initRoleState,
    handleAddMember,
    handleRemoveMember,
    handleAddTarget,
    handleRemoveTarget,
    handleTargetExecutionOption,
    handleTargetConditions,
    handleSetTargetClearance,
    reset,
  };
});
export type RoleStoreType = ReturnType<typeof useRoleStore>;


function getParamUpdate(
  targetAddress: string,
  funcCondition: FunctionCondition,
  original?: FunctionCondition,
): UpdateEvent[] {
  const updates = funcCondition.params.reduce((toUpdate, newParamConfig) => {
    // console.log("getParamUpdate - param:", newParamConfig)
    if (!newParamConfig) return toUpdate
    const originalParamConfig = original?.params.find((_param) => newParamConfig.index === _param?.index)
    // console.log("getParamUpdate - originalParam:", originalParamConfig)

    if (
      originalParamConfig &&
      newParamConfig.value === originalParamConfig.value &&
      newParamConfig.type === originalParamConfig.type &&
      newParamConfig.condition === originalParamConfig.condition
    ) {
      return toUpdate
    }

    return [
      ...toUpdate,
      {
        level: Level.SCOPE_PARAM,
        value: newParamConfig,
        old: newParamConfig,
        targetAddress,
        funcSighash: funcCondition.sighash,
      } as UpdateEvent,
    ]
  }, [] as UpdateEvent[])

  const removals = (original?.params ?? []).reduce((toRemove, originalParamConfig) => {
    const newParamConfig = funcCondition.params.find((_param) => originalParamConfig.index === _param?.index)

    if (
      newParamConfig == null &&
      updates.find((update: any) => update.value.index === originalParamConfig.index) == null // check if param was updated
    ) {
      // param was removed
      return [
        ...toRemove,
        {
          level: Level.SCOPE_PARAM,
          value: {
            ...originalParamConfig,
            type: ParameterType.NO_RESTRICTION, // remove restriction
          },
          old: originalParamConfig,
          targetAddress,
          funcSighash: funcCondition.sighash,
        },
      ] as UpdateEvent[]
    }
    return toRemove
  }, [] as UpdateEvent[])

  return [...updates, ...removals]
}

function getFunctionUpdate(
  target: Target,
  funcCondition: FunctionCondition,
  original?: FunctionCondition,
): UpdateEvent[] {
  if (!original && funcCondition.type === ConditionType.BLOCKED) return [];

  const isClearanceUpdated = original?.type !== funcCondition.type;
  const isExecutionOptionUpdated = original?.executionOption !== funcCondition.executionOption;

  if (funcCondition.type !== ConditionType.SCOPED) {
    /**
     * If Clearance is WILDCARDED or BLOCKED, only update clearance and execution option (if needed).
     */
    if (!isClearanceUpdated && isExecutionOptionUpdated) {
      return [
        {
          level: Level.UPDATE_FUNCTION_EXECUTION_OPTION,
          value: funcCondition,
          old: original as FunctionCondition,
          targetAddress: target.address,
        },
      ];
    }

    if (!isClearanceUpdated && (funcCondition.type === ConditionType.BLOCKED || !isExecutionOptionUpdated)) return [];

    return [
      {
        level: Level.SCOPE_FUNCTION,
        value: funcCondition,
        old: original || funcCondition,
        targetAddress: target.address,
      },
    ];
  }

  const events: UpdateEvent[] = [];

  if (isClearanceUpdated) {
    events.push({
      level: Level.SCOPE_FUNCTION,
      value: funcCondition,
      old: original || funcCondition,
      targetAddress: target.address,
    });
  } else if (isExecutionOptionUpdated) {
    events.push({
      level: Level.UPDATE_FUNCTION_EXECUTION_OPTION,
      value: funcCondition,
      old: original as FunctionCondition,
      targetAddress: target.address,
    });
  }

  // Function is SCOPED, check for parameter updates
  const paramsEvents = getParamUpdate(target.address, funcCondition, original);
  events.push(...paramsEvents);

  return events;
}
