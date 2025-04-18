import { ParamType } from "ethers";

export interface IRawTrx {
  funcName: string;
  args: any[];
}

export type Role = {
  id: string
  name: string
  targets: Target[]
  members: Member[]
}

export interface Target extends ConditionalEntity {
  id: string
  address: string
  conditions: TargetConditions
}

export type Member = {
  id: string
  address: string
}

export type FuncParams = Record<string, boolean[]>

export interface FlattenedParamType extends ParamType {
  index: number | null;
  parentIndex: number | null;
  parentName: string | null;
}

export interface ParamCondition {
  index: number
  type: ParameterType
  condition: ParamComparison
  // usually a single-element array, multiple values are used
  // only for ParamComparison.ONE_OF
  value: string[]
}

export interface FunctionCondition extends ConditionalEntity {
  sighash: string
  params: ParamCondition[]
}

export interface ConditionalEntity {
  type: ConditionType
  executionOption: ExecutionOption
}

export type TargetConditions = Record<string, FunctionCondition>

export type UpdateEventScopeTarget = {
  level: Level.SCOPE_TARGET;
  value: Target;
  old: Target;
};
export type UpdateEventFunctionCondition = {
  level: Level.SCOPE_FUNCTION | Level.UPDATE_FUNCTION_EXECUTION_OPTION
  value: FunctionCondition
  old: FunctionCondition
  targetAddress: string
};
export type UpdateEventParamCondition = {
  level: Level.SCOPE_PARAM
  funcSighash: string
  targetAddress: string
  value: ParamCondition
  old: ParamCondition
}

export type UpdateEvent = UpdateEventScopeTarget | UpdateEventFunctionCondition | UpdateEventParamCondition;
