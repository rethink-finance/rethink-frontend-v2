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
  EQUAL_TO = "EqualTo", // 0
  ONE_OF = "OneOf", // 3
  GREATER_THAN = "GreaterThan",  // 1
  LESS_THAN = "LessThan",  // 2
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
