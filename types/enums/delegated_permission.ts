import type { IStepperStep } from "~/types/stepper";
import { InputType } from "./stepper";

import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";

export enum DelegatedStep {
  Setup = "setup",
  Details = "details",
}

// define step map
export const DelegatedStepMap: Record<DelegatedStep, IStepperStep> = {
  [DelegatedStep.Setup]: {
    name: "Permission Setup",
    formTitle: "Set up Permission Function",
    key: DelegatedStep.Setup,
  },
  [DelegatedStep.Details]: {
    name: "Proposal Details",
    formTitle: "Provide Proposal Information",
    key: DelegatedStep.Details,
  },
};

// get all methods from ZodiacRoles contract
const proposalRoleModMethods = ZodiacRoles.abi.filter(
  (val) => val.type === "function"
);
// make a list of choices for the select field out of the methods
export const substepChoices = proposalRoleModMethods.map((val) => {
  return { title: val.name, value: val.name };
});
// define select field that will be used in all substeps
const selectField = {
  label: "Contract Method",
  key: "contractMethod",
  type: InputType.Select,
  defaultValue: substepChoices[0].value,
  choices: substepChoices,
};

// define field type for each input out of the abi
const defineFieldType = (val: any) => {
  const numberTypes = ["uint", "int"];
  const textTypes = ["address", "bytes"];

  if (numberTypes.some((type) => val.type.includes(type))) {
    return InputType.Number;
  } else if (textTypes.some((type) => val.type.includes(type))) {
    return InputType.Text;
  }
  return InputType.Text;
};

// define validation rules for each input out of the abi
const defineValidationRules = (val: any) => {
  const numberTypes = ["uint", "int"];
  const address = ["address", "bytes"];

  if (numberTypes.some((type) => val.type.includes(type))) {
    return [formRules.required, formRules.isPositiveNumber];
  } else if (address.some((type) => val.type.includes(type))) {
    return [formRules.required, formRules.isValidAddress];
  }
  return [formRules.required];
};

// shape substep fields for each method from ZodiacRoles contract
export const allSubsteps = proposalRoleModMethods.map((val: any) => {
  const substepFields = val.inputs.map((input: any) => {
    return {
      label: input.name,
      key: input.name,
      type: defineFieldType(input),
      rules: defineValidationRules(input),
      isArray: input.type.includes("[]"),
    };
  });

  // add select field to the beginning of each substep
  const substepFieldsWithSelect = [selectField, ...substepFields];

  return {
    [val.name]: substepFieldsWithSelect,
  };
});

// format array to object
function formatArrayToObject(array: { [key: string]: any }[]): any {
  const result: any = {};

  array.forEach((item) => {
    const key = Object.keys(item)[0];
    result[key] = item[key];
  });

  return result;
}

// define fields map
export const DelegatedPermissionFieldsMap: any = {
  [DelegatedStep.Setup]: formatArrayToObject(allSubsteps),

  [DelegatedStep.Details]: [
    {
      label: "Proposal Title",
      key: "proposalTitle",
      type: InputType.Text,
      placeholder: "E.g. Proposal Title",
      rules: [formRules.required],
    },
    {
      label: "Proposal Description",
      key: "proposalDescription",
      type: InputType.Textarea,
      placeholder: "E.g. Proposal Description",
      rules: [formRules.required],
    },
  ],
};
