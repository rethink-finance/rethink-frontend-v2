// src: https://github.com/gnosisguild/zodiac-modifier-roles-v1/blob/main/packages/app/src/utils/conditions.ts
import { ethers, type FunctionFragment, type JsonFragment, Interface } from "ethers";
import {
  ParamNativeType,
  ParameterType,
  ParamComparison,
  ConditionType, ExecutionOption,
} from "~/types/enums/zodiac-roles";
import type { FunctionCondition } from "~/types/zodiac-roles/role";
export function getFunctionConditionType(paramConditions: FunctionCondition["params"]) {
  return paramConditions.some((x) => x) ? ConditionType.SCOPED : ConditionType.BLOCKED
}

export function getKeyFromFunction(func: FunctionFragment) {
  return func.selector
}

export enum BooleanValue {
  FALSE = "false",
  TRUE = "true",
}
export const ConditionLabel: Record<ParamComparison, string> = {
  [ParamComparison.EQUAL_TO]: "is equal to",
  [ParamComparison.ONE_OF]: "is one of",
  [ParamComparison.GREATER_THAN]: "is greater than",
  [ParamComparison.LESS_THAN]: "is less than",
}

export function getNativeType(param?: ethers.ParamType): ParamNativeType {
  if (!param) return ParamNativeType.UNSUPPORTED

  if (param.baseType === "address") return ParamNativeType.ADDRESS
  if (param.baseType === "string") return ParamNativeType.STRING
  if (param.baseType === "bool") return ParamNativeType.BOOLEAN
  if (param.baseType === "tuple") return ParamNativeType.TUPLE
  if (param.baseType.startsWith("uint")) return ParamNativeType.UINT
  if (param.baseType.startsWith("int")) return ParamNativeType.INT
  if (param.baseType === "array") {
    if (param.arrayChildren?.baseType === "array") return ParamNativeType.UNSUPPORTED
    return ParamNativeType.ARRAY
  }
  if (param.baseType.startsWith("bytes") && param.baseType !== "bytes") {
    return ParamNativeType.BYTES_FIXED
  }
  return ParamNativeType.BYTES
}

export function getConditionsPerType(type: ParamNativeType): ParamComparison[] {
  switch (type) {
    case ParamNativeType.UINT:
      return [ParamComparison.EQUAL_TO, ParamComparison.ONE_OF, ParamComparison.LESS_THAN, ParamComparison.GREATER_THAN]

    case ParamNativeType.BOOLEAN:
      return [ParamComparison.EQUAL_TO]
  }

  return [ParamComparison.EQUAL_TO, ParamComparison.ONE_OF]
}

export function getConditionType(nativeType: ParamNativeType): ParameterType {
  // Are tuples support?
  if (nativeType === ParamNativeType.ARRAY) return ParameterType.DYNAMIC32
  if (nativeType === ParamNativeType.BYTES || nativeType === ParamNativeType.STRING) return ParameterType.DYNAMIC
  return ParameterType.STATIC
}

export function isWriteFunction(method: FunctionFragment) {
  if (!method.stateMutability) return true
  return !["view", "pure"].includes(method.stateMutability)
}

export const getWriteFunctions = (abi: JsonFragment[] | undefined): FunctionFragment[] => {
  if (!abi) return [];
  const iface = new Interface(abi);
  const writeFunctions: FunctionFragment[] = [];

  iface.forEachFunction((func: FunctionFragment) => {
    if (isWriteFunction(func)) {
      writeFunctions.push(func);
    }
  });
  return writeFunctions as FunctionFragment[]
}

export function formatParamValue(param: ethers.ParamType, value: string) {
  const nativeType = getNativeType(param)
  if (nativeType === ParamNativeType.ARRAY || nativeType === ParamNativeType.TUPLE) return JSON.parse(value)
  return value
}

export function getParamComparisonInt(paramComparison: ParamComparison): number {
  switch (paramComparison) {
    case ParamComparison.EQUAL_TO:
      return 0
    case ParamComparison.GREATER_THAN:
      return 1
    case ParamComparison.LESS_THAN:
      return 2
    case ParamComparison.ONE_OF:
      return 3
  }
}
export const ParamComparisonMap: Record<number, ParamComparison> = {
  0: ParamComparison.EQUAL_TO,
  1: ParamComparison.GREATER_THAN,
  2: ParamComparison.LESS_THAN,
  3: ParamComparison.ONE_OF,
};

export function getParameterTypeInt(parameterType: ParameterType): number {
  switch (parameterType) {
    case ParameterType.STATIC:
      return 0
    case ParameterType.DYNAMIC:
      return 1
    case ParameterType.DYNAMIC32:
      return 2
    case ParameterType.NO_RESTRICTION:
      throw new Error("No restriction should not go on chain. This should be unscoped via unscopeParameter")
  }
}
export const ParameterTypeMap: Record<number, ParameterType> = {
  0: ParameterType.STATIC,
  1: ParameterType.DYNAMIC,
  2: ParameterType.DYNAMIC32,
  3: ParameterType.NO_RESTRICTION,
};

export const ExecutionOptionMap: Record<number, ExecutionOption> = {
  0: ExecutionOption.NONE,
  1: ExecutionOption.SEND,
  2: ExecutionOption.DELEGATE_CALL,
  3: ExecutionOption.BOTH,
};
