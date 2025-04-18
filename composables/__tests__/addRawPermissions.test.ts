import { describe, expect, it } from "vitest";
import {
  fullPermissions,
  oneOfPermissions,
  scopeTargetPermissions,
  scopeTargetPermissionsResult,
  oneOfPermissionsResult,
  oneOfTwoPermissions,
  oneOfTwoPermissionsResult,
  oneOfTwoParamsDifferentFunctionPermissions,
  oneOfTwoParamsDifferentFunctionPermissionsResult,
  scopeAllowFunctionPermissions,
  scopeAllowFunctionPermissionsResult,
} from "~/composables/__tests__/mock_data/mockRawPermissions";
import { roleModFunctions } from "~/types/enums/delegated_permission";
import {
  ConditionType,
  ExecutionOption, indexToExecutionOption,
  indexToParameterType,
  ParamComparison,
  ParameterType,
} from "~/types/enums/zodiac-roles";
import type { FunctionCondition, ParamCondition, Target, TargetConditions } from "~/types/zodiac-roles/role";

describe("addRawPermissions", () => {
  it ("scopeTarget", () => {
    expect(parseRawTransactions(scopeTargetPermissions)).toEqual(scopeTargetPermissionsResult);
  });
  it ("scopeAllowFunction", () => {
    expect(parseRawTransactions(scopeAllowFunctionPermissions)).toEqual(scopeAllowFunctionPermissionsResult);
  });
  it ("scopeParameterAsOneOf", () => {
    expect(parseRawTransactions(oneOfPermissions)).toEqual(oneOfPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function", () => {
    expect(parseRawTransactions(oneOfTwoPermissions)).toEqual(oneOfTwoPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function, one param another function", () => {
    expect(parseRawTransactions(oneOfTwoParamsDifferentFunctionPermissions)).toEqual(oneOfTwoParamsDifferentFunctionPermissionsResult);
  })
  it ("full permissions json", () => {
    parseRawTransactions(fullPermissions)
    // expect(parseRawTransactions(fullPermissions)).toEqual(fullPermissionsResult);
  })
})

/***
interface Target extends ConditionalEntity
{
 id: string
 address: string
 conditions: Record<string, FunctionCondition>
 type: ConditionType
 executionOption: ExecutionOption
}

interface FunctionCondition extends ConditionalEntity
{
  type: ConditionType
  executionOption: ExecutionOption
  sighash: string
  params: ParamCondition[]
}

interface ParamCondition
{
  index: number
  type: ParameterType
  condition: ParamComparison
  // usually a single-element array, multiple values are used
  // only for ParamComparison.ONE_OF
  value: string[]
}
**/
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

// TODO instead of raising ContextError always push to custom permissions and just log errors
function parseRawTransactions(data: any[]) {
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
    let roleId: any;
    let targetAddress = "";
    let sighash = "";
    let executionOption: ExecutionOption | undefined;

    const getArg = (name: string) => {
      const arg = argsNameMap[name];
      if (!arg) {
        throw new ContextError("Raw permission arg is missing", { permission, inputName: name });
      }
      return arg.data;
    };

    const handlers: Record<string, () => void> = {
      scopeTarget: () => {
        targetAddress = getArg("targetAddress");
        roleId = getArg("role");
        if (roleId) {
          getOrCreateRoleTarget(roleId, targetAddress);
        } else {
          console.log("Missing role for permission", permission);
          customPermissions.push(permission);
        }
      },
      scopeAllowFunction: () => {
        targetAddress = getArg("targetAddress");
        roleId = getArg("role");
        sighash = getArg("functionSig");
        executionOption = indexToExecutionOption[getArg("options").toString()];
        if (roleId && sighash && executionOption !== undefined) {
          const target = getOrCreateRoleTarget(roleId, targetAddress);
          getOrCreateTargetFunctionCondition(target, sighash, ConditionType.WILDCARDED, executionOption);
        } else {
          console.warn("Missing role for permission", permission);
          customPermissions.push(permission);
        }
      },
      scopeParameterAsOneOf: () => {
        targetAddress = getArg("targetAddress");
        roleId = getArg("role");
        sighash = getArg("functionSig");
        const index = Number(getArg("paramIndex"));
        const paramType = indexToParameterType[getArg("paramType").toString()];
        const values = getArg("compValues");

        if (index === undefined || sighash === undefined) {
          throw new ContextError("Raw permission invalid index or sighash", { permission, func });
        }

        if (roleId) {
          const target = getOrCreateRoleTarget(roleId, targetAddress);
          getOrCreateTargetFunctionCondition(target, sighash, ConditionType.SCOPED, ExecutionOption.NONE);

          const paramCondition: ParamCondition = {
            index,
            type: paramType,
            condition: ParamComparison.ONE_OF,
            value: values,
          };
          target.conditions[sighash].params.push(paramCondition);
        } else {
          console.log("Missing role for permission", permission);
          customPermissions.push(permission);
        }
      },
      allowTarget: () => {
        console.log("Handle allowTarget", permission);
      },
    };

    if (funcName && handlers[funcName]) {
      handlers[funcName]();
    } else {
      customPermissions.push(permission)
    }
  })

  console.warn("\n------------------FINISHED\n\n")
  console.warn("roleTargets")
  console.warn(JSON.stringify(roleTargets, null, 2))

  // console.warn("targetsRemove", targetsRemove)
  console.warn("\n------------------customPermissions\n\n")
  console.warn(customPermissions)
  return roleTargets;
}

class ContextError extends Error {
  context: any;

  constructor(message: string, context: any) {
    super(message);
    this.context = context;
  }
}
