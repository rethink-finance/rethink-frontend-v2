import type { IStepperStep } from "~/types/stepper";
import type { FieldsMapType } from "./stepper";
import { InputType } from "./stepper";

export enum ExecutionStep {
  Setup = "setup",
  Details = "details",
}

// define step map
export const ExecutionStepMap: Record<ExecutionStep, IStepperStep> = {
  [ExecutionStep.Setup]: {
    name: "Execution Setup",
    formTitle: "Set up Execution’ Actions",
    formText:
      "<strong>CALL DATA</strong><p>The data for the function arguments you wish to send when the action executes</p>",
    key: ExecutionStep.Setup,
  },
  [ExecutionStep.Details]: {
    name: "Proposal Details",
    formTitle: "Provide Proposal Information",
    key: ExecutionStep.Details,
  },
};

// define fields map
export const DirectExecutionFieldsMap: FieldsMapType = {
  [ExecutionStep.Setup]: [
    {
      label: "Raw TX Data",
      key: "rawTxData",
      type: InputType.Textarea,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidHexString, formRules.required],
    },
    {
      label: "Gas To Send With Transaction",
      key: "gasToSendWithTransaction",
      type: InputType.Number,
      placeholder: "E.g. 0",
      min: 0,
      rules: [formRules.required, formRules.isNonNegativeNumber],
    },
    {
      label: "Address of Contract Interaction",
      key: "addressOfContractInteraction",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.required],
    },
    {
      label: "Operation",
      key: "operation",
      type: InputType.Text,
      placeholder: "uint8",
      rules: [formRules.required],
    },
  ],

  [ExecutionStep.Details]: [
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
