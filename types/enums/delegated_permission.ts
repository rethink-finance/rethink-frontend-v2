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

// define select field that will be used in all sub steps
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

  // default values for select boolean select field
  let choices = [] as { title: string; value: any }[];
  let defaultValue;

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
    type = InputType.Select;
    choices = [
      { title: "True", value: true },
      { title: "False", value: false },
    ];
    defaultValue = false;
  }

  return { type, placeholder, rules, choices, defaultValue };
};

// shape sub step fields for each method from ZodiacRoles contract
export const allSubSteps = proposalRoleModMethods.map((val: any) => {
  const subStepFields = val.inputs.map((input: any) => {
    const {
      type,
      placeholder,
      rules,
      choices,
      defaultValue,
    } = defineFieldDetails(input);

    return {
      label: formatFieldName(input.name),
      key: input.name,
      type,
      rules,
      placeholder,
      isArray: input.type.includes("[]"),
      choices,
      defaultValue,
    };
  });

  const selectFieldForSubStep = JSON.parse(JSON.stringify(selectField));
  selectFieldForSubStep.defaultValue = val.name;

  // add select field to the beginning of each substep
  const subStepFieldsWithSelect = [selectFieldForSubStep, ...subStepFields];

  return {
    [val.name]: subStepFieldsWithSelect,
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
  [DelegatedStep.Setup]: formatArrayToObject(allSubSteps),

  [DelegatedStep.Details]: [
    {
      label: "Proposal Title",
      key: "proposalTitle",
      type: InputType.Text,
      placeholder: "E.g. Proposal Title",
      charLimit: 150,
      rules: [formRules.required, formRules.charLimit(150)],
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
