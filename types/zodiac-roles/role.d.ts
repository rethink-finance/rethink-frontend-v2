import { ParamType } from "ethers";

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
