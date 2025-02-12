import type { FunctionFragment } from "ethers";

export function getParamsTypesTitle(func: FunctionFragment): string {
  if (!func.inputs.length) return "()"
  return "(" + func.inputs.map((input) => input.format("full")).join(", ") + ")"
}
