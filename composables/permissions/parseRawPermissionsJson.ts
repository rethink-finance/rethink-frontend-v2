import type { FunctionCondition, ParamCondition, Target, TargetConditions } from "~/types/zodiac-roles/role";
import { ConditionType, ExecutionOption, ParamComparison, ParameterType } from "~/types/enums/zodiac-roles";
import { roleModFunctions } from "~/types/enums/delegated_permission";
import { ExecutionOptionMap, ParamComparisonMap, ParameterTypeMap } from "~/composables/zodiac-roles/conditions";

/**
 * Parses a list of raw permission objects into a structured format compatible with the
 * Roles Modifier Graph Indexer UI.
 *
 * Converts custom permission JSON (typically from on-chain data or raw input) into
 * role-target-condition mappings that the UI expects. Recognized permission methods
 * are parsed and transformed into a normalized structure, while unrecognized or
 * incomplete permissions are collected as customPermissions.
 *
 * @param data - Array of raw permission objects, each containing a method index and associated arguments.
 *
 * @returns An object containing:
 *   - roleTargets: A nested map (roleId -> targetAddress -> Target object) representing parsed permissions
 *                  in the format required by the Roles Modifier Graph Indexer UI.
 *   - customPermissions: A list of permission objects that could not be matched or converted.
 */
export function parseRawPermissionsJson(data: any[]) {
  // Add everything else that we couldn't match to custom permissions.
  const customPermissions: any[] = [];
  // roleId -> targetId -> Target
  const roleTargets: Record<string, Record<string, Target>> = {};
  // const targetsRemove: Record<string, Target[]> = {};

  function getOrCreateRoleTarget(roleId: string, targetAddress: string): Target {
    if (roleTargets[roleId]) {
      if (roleTargets[roleId][targetAddress]) return roleTargets[roleId][targetAddress];
    } else {
      roleTargets[roleId] = {};
    }
    const target: Target = {
      id: `custom-${roleId}-TARGET-${targetAddress}`,
      type: ConditionType.SCOPED,
      address: targetAddress,
      executionOption: ExecutionOption.NONE,
      conditions: {} as TargetConditions,
    };

    roleTargets[roleId][targetAddress] = target;
    return target;
  }

  // Convert each permission to the Target or Member form.
  // The format the new permissions UI is using to display current permissions.
  // TODO instead of raising ContextError always push to custom permissions and just log errors
  data.forEach((permission: any) => {
    const methodIdx = permission.valueMethodIdx;
    const func = roleModFunctions[methodIdx];
    const funcName = func.name;
    console.log("funcName", methodIdx, func.name);

    // Assert len of args is same as length of func inputs.
    if (permission.value.length !== func.inputs.length) {
      throw new ContextError("Raw permission args mismatch", { permission, func });
    }
    // Create a map of args for easier access, argName -> arg
    const argsNameMap = Object.fromEntries(
      permission.value.map((arg: any) => [arg.name, arg]),
    );
    const getArg = (name: string) => {
      const arg = argsNameMap[name];
      if (!arg) {
        throw new ContextError("Raw permission arg is missing", { permission, inputName: name });
      }
      return arg.data;
    };

    const roleId: string = getArg("role");
    const targetAddress: string = getArg("targetAddress");

    const handlers: Record<string, () => void> = {
      scopeTarget: () => {
        if (roleId) {
          getOrCreateRoleTarget(roleId, targetAddress);
        } else {
          console.log("Missing role for permission", permission);
          customPermissions.push(permission);
        }
      },
      scopeAllowFunction: () => {
        const sighash = getArg("functionSig");
        const executionOption: ExecutionOption | undefined = ExecutionOptionMap[getArg("options")];

        if (roleId && sighash && executionOption !== undefined) {
          const target = getOrCreateRoleTarget(roleId, targetAddress);
          getOrCreateTargetFunctionCondition(target, sighash, ConditionType.WILDCARDED, executionOption);
        } else {
          console.warn("Missing role for permission", permission);
          customPermissions.push(permission);
        }
      },
      scopeParameterAsOneOf: () => {
        const sighash = getArg("functionSig");
        const paramIndex = Number(getArg("paramIndex"));
        const paramType = ParameterTypeMap[getArg("paramType")];
        const values = getArg("compValues");
        const target = getOrCreateRoleTarget(roleId, targetAddress);
        const funcCondition = getOrCreateTargetFunctionCondition(target, sighash, ConditionType.SCOPED, ExecutionOption.NONE);

        getOrCreateTargetFunctionConditionParam(
          target,
          sighash,
          funcCondition,
          paramIndex,
          paramType,
          ParamComparison.ONE_OF,
          values,
        )
      },
      scopeFunction: () => {
        const sighash = getArg("functionSig");
        const isParamScopedList = getArg("isParamScoped");
        const paramTypeList = getArg("paramType");
        const paramCompList = getArg("paramComp");
        const compValueList = getArg("compValue");
        const executionOption: ExecutionOption | undefined = ExecutionOptionMap[getArg("options")];

        // Make sure that are param lists have the same length.
        validateEqualLengthArrays([isParamScopedList, paramTypeList, paramCompList, compValueList]);

        const target = getOrCreateRoleTarget(roleId, targetAddress);
        const funcCondition = getOrCreateTargetFunctionCondition(target, sighash, ConditionType.SCOPED, ExecutionOption.NONE);
        funcCondition.executionOption = executionOption;

        for (let i = 0; i < compValueList.length; i++) {
          const isParamScoped = isParamScopedList[paramTypeList[i]];
          if (isParamScoped !== "true") {
            console.log(`Skip unscoped parameter ${i}`)
            continue;
          }
          const paramType = ParameterTypeMap[paramTypeList[i]];
          const paramComp = ParamComparisonMap[paramCompList[i]];
          const paramValues = [compValueList[i]];
          assertParamCompIsNotOneOf(paramComp);

          getOrCreateTargetFunctionConditionParam(
            target,
            sighash,
            funcCondition,
            i,
            paramType,
            paramComp,
            paramValues,
          )
        }
      },
      scopeParameter: () => {
        const sighash = getArg("functionSig");
        const paramIndex = Number(getArg("paramIndex"));
        const paramType = ParameterTypeMap[getArg("paramType")];
        const paramComp = ParamComparisonMap[getArg("paramComp")];
        const paramValues = [getArg("compValue")];

        const target = getOrCreateRoleTarget(roleId, targetAddress);
        const funcCondition = getOrCreateTargetFunctionCondition(target, sighash, ConditionType.SCOPED, ExecutionOption.NONE);
        getOrCreateTargetFunctionConditionParam(
          target,
          sighash,
          funcCondition,
          paramIndex,
          paramType,
          paramComp,
          paramValues,
        )
      },
      assignRoles: () => {
        console.log("Handle assignRoles", permission?.idx);
        throw new Error("Not implemented yet");
      },
      allowTarget: () => {
        console.log("Handle allowTarget", permission?.idx);
        throw new Error("Not implemented yet");
      },
      revokeTarget: () => {
        console.log("Handle revokeTarget", permission?.idx);
        throw new Error("Not implemented yet");
      },
      scopeRevokeFunction: () => {
        console.log("Handle scopeRevokeFunction", permission?.idx);
        throw new Error("Not implemented yet");
      },
      scopeFunctionExecutionOptions: () => {
        console.log("Handle scopeFunctionExecutionOptions", permission?.idx);
        throw new Error("Not implemented yet");
      },
    };

    if (funcName && handlers[funcName] && roleId && targetAddress) {
      handlers[funcName]();
    } else {
      console.log("Unhandled funcName", permission?.valueMethodIdx, funcName, "idx", permission?.idx);
      customPermissions.push(permission)
    }
  })

  console.warn("\n------------------FINISHED\n\n")
  console.warn("roleTargets")
  console.warn(JSON.stringify(roleTargets, null, 2))

  // console.warn("targetsRemove", targetsRemove)
  console.warn("\n------------------customPermissions\n\n")
  console.warn(customPermissions)
  return { roleTargets, customPermissions };
}

function getOrCreateTargetFunctionCondition(
  target: Target,
  sighash: string,
  conditionType: ConditionType = ConditionType.SCOPED,
  executionOption: ExecutionOption = ExecutionOption.NONE,
): FunctionCondition {
  if (!target.conditions[sighash]) {
    target.conditions[sighash] = {
      sighash,
      type: conditionType,
      executionOption,
      params: [] as ParamCondition[],
    } as FunctionCondition;
  }

  return target.conditions[sighash];
}

function getOrCreateTargetFunctionConditionParam(
  target: Target,
  sighash: string,
  funcCondition: any,
  paramIndex: number,
  paramType: ParameterType,
  paramComp: ParamComparison,
  paramValues: string[],
): ParamCondition {
  let paramCondition: ParamCondition | undefined = funcCondition.params.find((param: ParamCondition) => param.index === paramIndex)
  if (!paramCondition) {
    paramCondition = {
      index: paramIndex,
      type: paramType,
      condition: paramComp,
      value: paramValues,
    };
    target.conditions[sighash].params.push(paramCondition);
  } else {
    if (paramCondition.index !== paramIndex) {
      throw new Error(`existingParam index mismatch index: ${paramCondition.index} loop index: ${paramIndex}`)
    }
    paramCondition.type = paramType;
    paramCondition.condition = paramComp;
    paramCondition.value = paramValues; // TODO merge with existing values? better not
  }

  return paramCondition;
}


class ContextError extends Error {
  context: any;

  constructor(message: string, context: any) {
    super(message);
    this.context = context;
  }
}

function assertParamCompIsNotOneOf(paramComp:ParamComparison) {
  if (paramComp === ParamComparison.ONE_OF) {
    /**
     * Because OneOf isn't supported in Zodiac Roles v1:
     * You must emit multiple permission entries, each with EQUAL_TO + 1 value.
     * The ONE_OF option is just frontend sugar.
     */
    throw new Error("OneOf Comparison must be set via dedicated function")
  }
}

function validateEqualLengthArrays(arrays: any[][]) {
  const lengths = new Set(arrays.map(arr => arr.length));
  if (lengths.size !== 1) {
    // There should only be one element, all items should have be of the same length.
    throw new Error(`Arrays are not of the same length, there are ${lengths.size} different lengths.`)
  }
}
