import { ParamType } from "ethers";
import type { FlattenedParamType } from "~/types/zodiac-roles/role";


export const flattenAbiFunctionInputs = (
  inputs: FlattenedParamType[] | ReadonlyArray<ParamType>,
) => {
  let indexCounter = 0;
  const flatInputs: FlattenedParamType[] = [];

  function processInputs(
    inputs?: FlattenedParamType[] | ReadonlyArray<ParamType>,
    parentIndex: number | null = null,
    parentName: string = "",
  ) {
    if (!inputs) return;

    for (const input of inputs) {
      if (input.isTuple() && input.components) {
        // Concatenate parentName with input.name, allowing multiple
        // tuple levels of parent names to be saved. Name is including
        // all parent tuple variable names.
        let newParentName = input.name;
        if (parentName) {
          newParentName = `${parentName} ${newParentName}`;
        }
        processInputs(
          input?.components as FlattenedParamType[],
          indexCounter,
          newParentName,
        );
      } else {
        // Properly instantiate ParamType to retain methods
        const wrappedParam = ParamType.from(input) as FlattenedParamType;

        // Create a new FlattenedParamType instance without breaking prototype methods
        // const wrappedParam: FlattenedParamType = param as FlattenedParamType;
        wrappedParam.index = indexCounter;
        wrappedParam.parentIndex = parentIndex;
        wrappedParam.parentName = parentName;

        flatInputs.push(wrappedParam);
        indexCounter++;
      }
    }
  }

  processInputs(inputs);
  return flatInputs;
}
