import { InputType } from "./stepper";
import type { IStepperStep } from "~/types/stepper";

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

export const formatFieldName = (name: string) => {
  // split camelCase to words
  let output = name.replace(/([A-Z])/g, " $1");
  // capitalize the first letter
  output = output.charAt(0).toUpperCase() + output.slice(1);
  return output;
};

// get all methods from ZodiacRoles contract
const proposalRoleModMethods = ZodiacRoles.abi.filter(
  (val) => val.type === "function",
);
// make a list of choices for the select field out of the methods
export const substepChoices = proposalRoleModMethods.map((val) => {
  return { title: formatFieldName(val?.name || ""), value: val.name };
});

// define select field that will be used in all substeps
const selectField = {
  label: "Contract Method",
  key: "contractMethod",
  type: InputType.Select,
  defaultValue: substepChoices[0].value,
  choices: substepChoices,
};

const defineFieldDetails = (val: any) => {
  const numberTypes = ["uint", "int"];
  const textTypes = ["address", "bytes"];
  const boolTypes = ["bool"];

  const addressPlaceholder = "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  let type = InputType.Text;
  let placeholder = `E.g. ${val.type}`.replace("[]", "");
  let rules = [formRules.required];

  if (numberTypes.some((type) => val.type.includes(type))) {
    type = InputType.Number;

    if (val.type.includes("uint8")) {
      rules = [formRules.required, formRules.isValidUint8];
    } else if (val.type.includes("uint16")) {
      rules = [formRules.required, formRules.isValidUint16];
    }
  } else if (textTypes.some((type) => val.type.includes(type))) {
    if (val.type.includes("address")) {
      placeholder = addressPlaceholder;
    }
    rules = [formRules.required, formRules.isValidAddress];
  } else if (boolTypes.some((type) => val.type.includes(type))) {
    type = InputType.Checkbox;
  }

  return { type, placeholder, rules };
};

// shape substep fields for each method from ZodiacRoles contract
export const allSubsteps = proposalRoleModMethods.map((val: any) => {
  const substepFields = val.inputs.map((input: any) => {
    const { type, placeholder, rules } = defineFieldDetails(input);

    return {
      label: formatFieldName(input.name),
      key: input.name,
      type,
      rules,
      placeholder,
      isArray: input.type.includes("[]"),
    };
  });

  const selectFieldForSubstep = JSON.parse(JSON.stringify(selectField));
  selectFieldForSubstep.defaultValue = val.name;

  // add select field to the beginning of each substep
  const substepFieldsWithSelect = [selectFieldForSubstep, ...substepFields];

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
