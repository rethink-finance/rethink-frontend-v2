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
  scopeFunctionPermissions,
  scopeFunctionPermissionsResult,
  scopeFunctionWithUnscopedParamsPermissions,
  scopeFunctionWithUnscopedParamsPermissionsResult,
  scopeFunctionWithTwoParamsPermissionsResult,
  scopeFunctionWithTwoParamsPermissions, scopeFunctionWithOneOfParamPermissions, fullPermissionsResult,
} from "~/composables/__tests__/mock_data/mockRawPermissions";
import { roleModFunctions } from "~/types/enums/delegated_permission";
import {
  ConditionType,
  ExecutionOption,
  ParamComparison,
} from "~/types/enums/zodiac-roles";
import type { FunctionCondition, ParamCondition, Target, TargetConditions } from "~/types/zodiac-roles/role";
import { ExecutionOptionMap, ParamComparisonMap, ParameterTypeMap } from "~/composables/zodiac-roles/conditions";

describe("addRawPermissions", () => {
  it ("scopeTarget", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(scopeTargetPermissions));
    expect(result).toEqual(scopeTargetPermissionsResult);
  });
  it ("scopeAllowFunction", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(scopeAllowFunctionPermissions));
    expect(result).toEqual(scopeAllowFunctionPermissionsResult);
  });
  it ("scopeFunction", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(scopeFunctionPermissions));
    expect(result).toEqual(scopeFunctionPermissionsResult);
  });
  it ("scopeFunctionWithUnscopedParams (unscoped param should be ignored)", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(scopeFunctionWithUnscopedParamsPermissions));
    expect(result).toEqual(scopeFunctionWithUnscopedParamsPermissionsResult);
  });
  it ("scopeFunctionWithTwoParams", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(scopeFunctionWithTwoParamsPermissions));
    expect(result).toEqual(scopeFunctionWithTwoParamsPermissionsResult);
  });
  it ("scopeFunctionWithOneOfParam (should throw exc)",  () => {
    expect(() => {
      parseRawTransactions(scopeFunctionWithOneOfParamPermissions);
    }).toThrow("OneOf Comparison must be set via dedicated function");
  });
  it ("scopeParameterAsOneOf", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(oneOfPermissions));
    expect(result).toEqual(oneOfPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(oneOfTwoPermissions));
    expect(result).toEqual(oneOfTwoPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function, one param another function", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(oneOfTwoParamsDifferentFunctionPermissions));
    expect(result).toEqual(oneOfTwoParamsDifferentFunctionPermissionsResult);
  })
  it ("full permissions json", () => {
    const result = testWithParamArrayCheck(() => parseRawTransactions(fullPermissions));
    parseRawTransactions(fullPermissions)
    // expect(result).toEqual(fullPermissionsResult);
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
        const index = Number(getArg("paramIndex"));
        const paramType = ParameterTypeMap[getArg("paramType")];
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
      scopeFunction: () => {
        const sighash = getArg("functionSig");
        const isParamScopedList = getArg("isParamScoped");
        const paramTypeList = getArg("paramType");
        const paramCompList = getArg("paramComp");
        const compValueList = getArg("compValue");
        const executionOption: ExecutionOption | undefined = ExecutionOptionMap[getArg("options")];

        // Make sure that are param lists have the same length.
        validateEqualLengthArrays([isParamScopedList, paramTypeList, paramCompList, compValueList]);

        if (executionOption === undefined || sighash === undefined) {
          throw new ContextError("Raw permission invalid index or sighash", { permission, func });
        }
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

          if (paramComp === ParamComparison.ONE_OF) {
            /**
             * Because OneOf isn't supported in Zodiac Roles v1:
             * You must emit multiple permission entries, each with EQUAL_TO + 1 value.
             * The ONE_OF option is just frontend sugar.
             */
            throw new Error("OneOf Comparison must be set via dedicated function")
          }

          let paramCondition: ParamCondition | undefined = funcCondition.params.find((param: ParamCondition) => param.index === i)
          if (!paramCondition) {
            paramCondition = {
              index: i,
              type: paramType,
              condition: paramComp,
              value: paramValues,
            };
            target.conditions[sighash].params.push(paramCondition);
          } else {
            if (paramCondition.index !== i) {
              throw new Error(`existingParam index mismatch index: ${paramCondition.index} loop index: ${i}`)
            }
            paramCondition.type = paramType;
            paramCondition.condition = paramComp;
            paramCondition.value = paramValues; // TODO merge with existing values? better not
          }
        }
      },
      allowTarget: () => {
        console.log("Handle allowTarget", permission);
      },
    };

    if (funcName && handlers[funcName] && roleId && targetAddress) {
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

function validateEqualLengthArrays(arrays: any[][]) {
  const lengths = new Set(arrays.map(arr => arr.length));
  if (lengths.size !== 1) {
    // There should only be one element, all items should have be of the same length.
    throw new Error(`Arrays are not of the same length, there are ${lengths.size} different lengths.`)
  }
}
function assertAllParamValuesAreArrays(roleTargets: Record<string, Record<string, Target>>) {
  for (const role of Object.values(roleTargets)) {
    for (const target of Object.values(role)) {
      for (const fn of Object.values(target.conditions)) {
        for (const param of fn.params) {
          if (!Array.isArray(param.value)) {
            throw new TypeError(`Expected param.value to be an array, but got: ${typeof param.value}`);
          }
        }
      }
    }
  }
}

function testWithParamArrayCheck(testFn: () => Record<string, Record<string, Target>>) {
  const result = testFn();
  // Assert that are values in params are arrays, even if they have only one value or none.
  assertAllParamValuesAreArrays(result);
  return result;
}
