// store/role.ts
import {
  type BigNumberish,
  type BytesLike,
  type FunctionFragment, type JsonFragment,
} from "ethers";
import { defineStore } from "pinia";
import { getParamComparisonInt, getParameterTypeInt, getWriteFunctions } from "~/composables/zodiac-roles/conditions";
import {
  Roles__factory as RolesFactory,
} from "~/composables/zodiac-roles/contracts/typechain-types";
import type { Explorer } from "~/services/explorer";
import type { ChainId } from "~/types/enums/chain_id";
import {
  ConditionType,
  EntityStatus,
  ExecutionOption,
  Level,
  ParamComparison,
  ParameterType,
} from "~/types/enums/zodiac-roles";
import type {
  FunctionCondition,
  IRawTrx, Member,
  ParamCondition,
  Role,
  Target,
  TargetConditions,
  UpdateEvent,
  UpdateEventParamCondition,
} from "~/types/zodiac-roles/role";

export const rolesInterface = RolesFactory.createInterface();

// Define the store
export const useRoleStore = defineStore("roleStore", () => {
  // State
  const roleId = ref<string>("");
  const role = ref<Role | undefined>(undefined);
  const activeTargetId = ref<string | undefined>(undefined);
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
  const { $getExplorer } = useNuxtApp();
  // Store user's custom ABIs.
  // TODO could save them to localForage also but make sure to show a button to reset to original ABI
  const customAbiMap = ref<Record<string, JsonFragment[]>>({});

  // Function to initialize state
  function initRoleState(id: string | undefined, r?: Role) {
    console.log("Init role state", id, r);

    roleId.value = id || "";
    role.value = r;

    members.value = {
      list: r?.members.map((member: Member) => member.address) || [],
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
  const activeTarget = computed(() => {
    return targets.value.list.find((t: Target) => t.id === activeTargetId.value) ||
      targets.value.add.find((t: Target) => t.id === activeTargetId.value);
  });

  const getTargetStatus = computed(() => (target: Target) => {
    if (!target?.id) return EntityStatus.NONE
    if (targets.value.remove.includes(target?.address)) return EntityStatus.REMOVE
    if (targets.value.add.find((_target: Target) => _target?.id === target?.id)) return EntityStatus.PENDING
    return EntityStatus.NONE
  });
  const getMemberStatus = computed(() => (member: string) => {
    if (members.value.remove.includes(member)) return EntityStatus.REMOVE
    if (members.value.add.includes(member)) return EntityStatus.PENDING
    return EntityStatus.NONE
  });

  /**
   * Actions
   */
  // Function to determine Role ID
  // TODO this goes to roles store
  function getRoleId(roleId: string | undefined, roles: Role[]): string | undefined {
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

  function getTargetUpdate(targetId: string): UpdateEvent[] {
    const updatedTarget = [...targets.value.list, ...targets.value.add].find((_target) => _target.id === targetId);
    if (!updatedTarget) return [];

    const originalTarget = role.value?.targets.find((_target: Target) => _target.id === targetId);
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
  }

  function handleRemoveTarget(target: Target, remove: boolean = true) {
    console.log("handleRemoveTarget", 1);
    if (activeTargetId.value === target.id) {
      activeTargetId.value = undefined;
    }
    console.log("handleRemoveTarget", 2);

    if (!remove) {
      targets.value.remove = targets.value.remove.filter((_target) => _target !== target.address);
      return;
    }
    console.log("handleRemoveTarget", 3);

    if (targets.value.add.find((_target: Target) => _target.address === target.address)) {
      targets.value.add = targets.value.add.filter((_target: Target) => _target.address !== target.address);
      return;
    }
    console.log("handleRemoveTarget", 4);

    if (!targets.value.remove.includes(target.address)) {
      targets.value.remove.push(target.address);
    }
  }

  function handleAddTarget(target: Target) {
    const currentTarget =
      targets.value.add.find((_target: Target) => target.address.toLowerCase() === _target.address.toLowerCase()) ||
      targets.value.list.find((_target: Target) => target.address.toLowerCase() === _target.address.toLowerCase());

    if (currentTarget) {
      activeTargetId.value = currentTarget.id;
      return;
    }

    activeTargetId.value = target.id;
    targets.value.add.push({ ...target, address: target.address.toLowerCase() });
  }

  function handleRemoveMember(member: string, remove: boolean = true) {
    console.warn("remove mebmer", member, remove);
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

  function handleTargetExecutionOption(targetId: string, option: ExecutionOption) {
    const replaceValue = (targets: Target[]) =>
      replaceTargetValue(targets, targetId, { executionOption: option });

    if (targets.value.list.find((target: Target) => target.id === targetId)) {
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

    if (targets.value.list.find((target: Target) => target.id === targetId)) {
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

  function handleSetTargetClearance(targetId: string, option: ConditionType) {
    const replaceOption = (target: Target): Target => {
      if (target.id !== targetId) return target;
      return { ...target, executionOption: ExecutionOption.NONE, type: option };
    };

    targets.value.add = targets.value.add.map(replaceOption);
    targets.value.list = targets.value.list.map(replaceOption);
  }

  function reset(newRole: Role, newRoleId: string) {
    roleId.value = newRoleId;
    role.value = newRole;
    members.value.list = newRole?.members.map((m: Member) => m.address) || [];
    members.value.add = [];
    members.value.remove = [];
    targets.value.list = newRole?.targets || [];
    targets.value.add = [];
    targets.value.remove = [];
  }

  function getTargetTransaction(target: Target): IRawTrx {
    if (!role?.value?.id) throw new Error("No role");

    switch (target.type) {
      case ConditionType.SCOPED:
        console.log("[getTargetTransaction] scopeTarget")
        return {
          funcName: "scopeTarget",
          args: [roleId.value, target.address],
        }
      case ConditionType.WILDCARDED:
        console.log("[getTargetTransaction] allowTarget")
        return {
          funcName: "allowTarget",
          args: [roleId.value, target.address, target.executionOption],
        }
    }
    console.log("[getTargetTransaction] revoke target")
    return {
      funcName: "revokeTarget",
      args: [roleId.value, target.address],
    }
  }

  function getFunctionTransaction(
    target: Target,
    funcCondition: FunctionCondition,
    func?: FunctionFragment,
  ): IRawTrx {
    if (!role?.value?.id) throw new Error("No role");

    if (funcCondition.type === ConditionType.BLOCKED) {
      console.log("[getFunctionTransaction] scope revoke function", [roleId.value, target.address, funcCondition.sighash])
      return {
        funcName: "scopeRevokeFunction",
        args: [
          roleId.value,
          target.address,
          funcCondition.sighash,
        ],
      }
    }

    if (funcCondition.type === ConditionType.WILDCARDED) {
      console.log("[getFunctionTransaction] scope allow function", [
        roleId.value,
        target.address,
        funcCondition.sighash,
        funcCondition.executionOption,
      ])
      return {
        funcName: "scopeAllowFunction",
        args: [
          roleId.value,
          target.address,
          funcCondition.sighash,
          funcCondition.executionOption,
        ],
      }
    }

    if (!func) {
      throw new Error(
        `Missing ABI for target ${target.address}: Function with sighash ${funcCondition.sighash} requires ABI data to determine parameter types. \nPlease update the contract ABI to include this function.`,
      )
    }

    const paramIndexes = funcCondition.params.map((param: ParamCondition) => param?.index)
    const paramsLength = Math.max(-1, ...paramIndexes) + 1

    const isParamScoped: boolean[] = []
    const paramType: BigNumberish[] = []
    const paramComp: BigNumberish[] = []
    const compValue: BytesLike[] = []

    for (let i = 0; i < paramsLength; i++) {
      const param = funcCondition.params.find((param: ParamCondition) => param.index === i)
      // TODO what if it is ONE_OF? unhandled case!
      /**
       * Because OneOf isn't supported in Zodiac Roles v1:
       * You must emit multiple permission entries, each with EQUAL_TO + 1 value.
       * The ONE_OF option is just frontend sugar.
       */
      if (param && param.condition !== ParamComparison.ONE_OF) {
        isParamScoped.push(true)
        paramType.push(getParameterTypeInt(param.type))
        paramComp.push(getParamComparisonInt(param.condition))
        compValue.push(param.value[0])
      } else {
        console.warn("IS ACTUALLY ONE OF!", param)
        isParamScoped.push(false)
        paramType.push(0)
        paramComp.push(0)
        compValue.push("0x")
      }
    }

    console.log("[getFunctionTransaction] scope function", [
      roleId.value,
      target.address,
      funcCondition.sighash,
      isParamScoped,
      paramType,
      paramComp,
      compValue,
      funcCondition.executionOption,
    ])
    return {
      funcName: "scopeFunction",
      args: [
        roleId.value,
        target.address,
        funcCondition.sighash,
        isParamScoped,
        paramType,
        paramComp,
        compValue,
        funcCondition.executionOption,
      ],
    }
  }

  /**
   * Will not check that the members and target operations are valid against the data on chain.
   * For instance requests for adding a member that is already a member or removing a member
   * that is not a member will be executed.
   * @param chainId
   * @returns calldatas array
   */
  async function updateRole(chainId: ChainId): Promise<IRawTrx[]> {
    if (!role?.value?.id) throw new Error("No role");

    console.log("roleId: ", roleId.value)
    console.log("members to add: ", members.value.add)
    console.log("members to remove: ", members.value.remove)
    console.log("targets to add: ", targets.value.add)
    console.log("targets to remove: ", targets.value.remove)
    console.log("role: ", role)

    const rawTransactions: IRawTrx[] = [];
    members.value.add.forEach((member: string) => {
      rawTransactions.push({
        funcName: "assignRoles",
        args: [member, [roleId.value], [true]],
      })
    });

    members.value.remove.forEach((member: string) => {
      rawTransactions.push({
        funcName: "assignRoles",
        args: [member, [roleId.value], [false]],
      })
    });

    targets.value.remove.forEach((target: string) => {
      rawTransactions.push({
        funcName: "revokeTarget",
        args: [roleId.value, target],
      })
    });

    const explorer: Explorer = $getExplorer(chainId);
    const targetAbis: any = {};

    const targetTxPromises = [...targets.value.list, ...targets.value.add].map(async (target) => {
      console.log("target: ", target)
      const updateEvents = getTargetUpdate(target.id)
      console.warn("updateEvents", updateEvents);

      let functions: Record<string, FunctionFragment> = {}
      try {
        // TODO: move this part to getFunctionTransaction and cache values instead of here doing it everytime even
        //   if it's not needed
        if (customAbiMap.value[target.address]) {
          // Take user's custom ABI if he provided it.
          targetAbis[target.address] = customAbiMap.value[target.address];
        } else if (!targetAbis[target.address]) {
          // If there is no ABI specified, try to fetch it from the explorer.
          console.log("fetch ABI for target", target.address, targetAbis[target.address])
          const [abiResponse, proxyAddress] = await explorer.abi(target.address);
          targetAbis[target.address] = abiResponse;
        }

        const targetABI: JsonFragment[] = targetAbis[target.address];
        functions = getWriteFunctions(targetABI)
          .reduce((obj, func) => {
            return { ...obj, [func.selector]: func }
          }, functions)
      } catch (e) {
        console.warn("failed to fetch ABI of target", target.address)
      }

      updateEvents.filter(
        event => event.level === Level.SCOPE_TARGET,
      ).forEach((event) => {
        rawTransactions.push(
          getTargetTransaction(event.value as Target),
        );
      });

      updateEvents.filter(event =>
        event.level === Level.UPDATE_FUNCTION_EXECUTION_OPTION
        && "targetAddress" in event
        && event?.targetAddress === target.address,
      ).forEach((event) => {
        const value = event.value as FunctionCondition
        rawTransactions.push({
          funcName: "scopeFunctionExecutionOptions",
          args: [roleId.value, target.address, value.sighash, value.executionOption],
        });
      });

      const scopedFunctions: string[] = []
      updateEvents.filter(event =>
        event.level === Level.SCOPE_FUNCTION
        && "targetAddress" in event
        && event?.targetAddress === target.address,
      ).forEach((event) => {
        const value = event.value as FunctionCondition;
        scopedFunctions.push(value.sighash)
        rawTransactions.push(
          getFunctionTransaction(target, value, functions[value.sighash]),
        );
      });

      // Group Param Events by Function
      const paramEventsPerFunction = updateEvents
        .filter(
          (event): event is UpdateEventParamCondition => event?.level === Level.SCOPE_PARAM
            && "targetAddress" in event
            && event?.targetAddress === target.address,
        )
        .reduce((obj, event): Record<string, ParamCondition[]> => {
          if (event.level !== Level.SCOPE_PARAM) return obj

          /*
           Param conditions are configure while scoping a function or can be updated independently.
           If it was configured in scoping the function, it doesn't need to be updated.
           Unless it's a `ONE_OF` param condition.
           */
          if (event.value.condition !== ParamComparison.ONE_OF && scopedFunctions.includes(event.funcSighash)) return obj

          const funcParams = obj[event.funcSighash] || []
          return {
            ...obj,
            [event.funcSighash]: [...funcParams, event.value],
          }
        }, {} as Record<string, ParamCondition[]>)
      console.log("paramEventsPerFunction", paramEventsPerFunction);
      Object.entries(paramEventsPerFunction)
        .forEach(([sighash, params]) => {
          params.forEach((paramCondition: ParamCondition) => {
            let rawTrx = {
              funcName: "scopeParameterAsOneOf",
              args: [
                roleId.value,
                target.address,
                sighash,
                paramCondition.index,
                getParameterTypeInt(paramCondition.type),
                paramCondition.value,
              ],
            };
            if (paramCondition.type === ParameterType.NO_RESTRICTION) {
              rawTrx = {
                funcName: "unscopeParameter",
                args: [
                  roleId.value,
                  target.address,
                  sighash,
                  paramCondition.index,
                ],
              };
            } else if (paramCondition.condition !== ParamComparison.ONE_OF) {
              rawTrx = {
                funcName: "scopeParameter",
                args: [
                  roleId.value,
                  target.address,
                  sighash,
                  paramCondition.index,
                  getParameterTypeInt(paramCondition.type),
                  getParamComparisonInt(paramCondition.condition),
                  paramCondition.value[0],
                ],
              };
            }
            rawTransactions.push(rawTrx);
          })
        })
    })

    await Promise.all(targetTxPromises)
    console.warn("rawTransactions", rawTransactions)
    return rawTransactions
  }

  return {
    roleId,
    role,
    activeTargetId,
    members,
    targets,
    activeTarget,
    customAbiMap,
    getMemberStatus,
    getTargetStatus,
    getRoleId,
    initRoleState,
    updateRole,
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
    const originalParamConfig = original?.params.find((_param: ParamCondition) => newParamConfig.index === _param?.index)
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
    const newParamConfig = funcCondition.params.find((_param: ParamCondition) => originalParamConfig.index === _param?.index)

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
