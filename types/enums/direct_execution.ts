import type { IExecutionStep } from "~/types/execution_step";

export enum ExecutionStep {
  Setup = "setup",
  Details = "details",
}

export const ExecutionStepMap: Record<ExecutionStep, IExecutionStep> = {
  [ExecutionStep.Setup]: {
    name: "Execution Setup",
    formTitle: "Set up Execution’ Actions",
    formText:
      "<p>CALL DATAS</p><p>The data for the function arguments you wish to send when the action executes</p>",
    key: ExecutionStep.Setup,
  },
  [ExecutionStep.Details]: {
    name: "Proposal Details",
    formTitle: "Provide Proposal Information",
    key: ExecutionStep.Details,
  },
};

// this is part of stepper form
export type FieldsMapType = {
  [key in string]: {
    label: string;
    key: string;
    type: InputType;
    placeholder?: string;
    rules?: any[];
    min?: number;
  }[];
};

// this is part of stepper form
export enum InputType {
  Text = "text",
  Textarea = "textarea",
  Number = "number",
}
export const defaultInputTypeValue: Record<InputType, any> = {
  [InputType.Text]: "",
  [InputType.Textarea]: "",
  [InputType.Number]: 0,
};

export const DirectExecutionFieldsMap: FieldsMapType = {
  [ExecutionStep.Setup]: [
    {
      label: "Row TX",
      key: "rowTX",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.required],
    },
    {
      label: "Gas to send with transaction",
      key: "gasToSendWithTransaction",
      type: InputType.Number,
      placeholder: "E.g. 0",
      min: 0,
      rules: [formRules.required, formRules.isPositiveNumber],
    },
    {
      label: "Address of Contract Interaction",
      key: "addressOfContractInteraction",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.required],
    },
    {
      label: "Operations",
      key: "operations",
      type: InputType.Textarea,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.required],
    },
  ],

  [ExecutionStep.Details]: [
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
