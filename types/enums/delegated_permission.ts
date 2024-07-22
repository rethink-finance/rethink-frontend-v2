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


// get all methods from ZodiacRoles contract
const proposalRoleModMethods = ZodiacRoles.abi.filter(
  (func) => func.type === "function",
);
// make a list of choices for the select field out of the methods
export const roleModMethodChoices = proposalRoleModMethods.map((func) => {
  return { title: abiFunctionNameToLabel(func?.name || ""), value: func.name };
});

// define select field that will be used in all sub steps
const selectField = {
  label: "Contract Method",
  key: "contractMethod",
  type: InputType.Select,
  defaultValue: roleModMethodChoices[0].value,
  choices: roleModMethodChoices,
};

const parseFuncInputDetails = (input: any) => {
  const numberTypes = ["uint", "int"];
  const textTypes = ["address", "bytes"];
  const boolTypes = ["bool"];
  const addressPlaceholder = "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  let type = InputType.Text;
  let placeholder = `E.g. ${input.type}`.replace("[]", "");
  let rules = [formRules.required];

  // default values for select boolean select field
  let choices = [] as { title: string; value: any }[];
  let defaultValue;

  if (numberTypes.some((type) => input.type.includes(type))) {
    type = InputType.Number;

    if (input.type.includes("uint8")) {
      rules = [formRules.required, formRules.isValidUint8];
    } else if (input.type.includes("uint16")) {
      rules = [formRules.required, formRules.isValidUint16];
    }
  } else if (textTypes.some((type) => input.type.includes(type))) {
    if (input.type.includes("address")) {
      placeholder = addressPlaceholder;
    }
    rules = [formRules.required, formRules.isValidAddress];
  } else if (boolTypes.some((type) => input.type.includes(type))) {
    type = InputType.Select;
    choices = [
      { title: "True", value: true },
      { title: "False", value: false },
    ];
    defaultValue = false;
  }

  return {
    label: abiFunctionNameToLabel(input.name),
    key: input.name,
    internalType: input.internalType,
    type,
    rules,
    placeholder,
    isArray: input.type.includes("[]"),
    choices,
    defaultValue,
  }
};

// shape sub step fields for each method from ZodiacRoles contract
export const proposalRoleModMethodAbiMap = proposalRoleModMethods.reduce((acc: any, functionAbi: any) => {
  acc[functionAbi.name] = functionAbi;
  return acc;
}, {});
export const proposalRoleModMethodStepsMap = proposalRoleModMethods.reduce((acc: any, functionAbi: any) => {
  const subStepFields = functionAbi.inputs.map(parseFuncInputDetails);

  const selectFieldForSubStep = JSON.parse(JSON.stringify(selectField));
  selectFieldForSubStep.defaultValue = functionAbi.name;

  // add select field to the beginning of each sub-step
  acc[functionAbi.name] = [selectFieldForSubStep, ...subStepFields];
  return acc;
}, {});

// define fields map
export const DelegatedPermissionFieldsMap: any = {
  [DelegatedStep.Setup]: proposalRoleModMethodStepsMap,

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
