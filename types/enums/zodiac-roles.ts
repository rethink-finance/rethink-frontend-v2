export enum ExecutionOption {
  NONE,
  SEND,
  DELEGATE_CALL,
  BOTH,
}

export enum EntityStatus {
  REMOVE,
  PENDING,
  NONE,
}

export enum ParamComparison {
  EQUAL_TO = "EqualTo",
  ONE_OF = "OneOf",
  GREATER_THAN = "GreaterThan",
  LESS_THAN = "LessThan",
}

export enum ParameterType {
  STATIC = "Static",
  DYNAMIC = "Dynamic",
  DYNAMIC32 = "Dynamic32",
  NO_RESTRICTION = "NoRestriction",
}

export enum ParamNativeType {
  INT,
  UINT,
  BOOLEAN,
  BYTES,
  BYTES_FIXED,
  ADDRESS,
  STRING,
  ARRAY,
  TUPLE,
  UNSUPPORTED,
}

export enum ConditionType {
  BLOCKED = "None",
  WILDCARDED = "Target",
  SCOPED = "Function",
}

export enum Level {
  SCOPE_TARGET, // Allowed, Scoped, Blocked
  SCOPE_FUNCTION, // Allowed, Scoped, Blocked
  SCOPE_PARAM,
  UPDATE_FUNCTION_EXECUTION_OPTION,
}
