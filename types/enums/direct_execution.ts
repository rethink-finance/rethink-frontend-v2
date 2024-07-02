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

type DirectExecutionFieldsMapType = {
  [key in ExecutionStep]: {
    label: string;
    key: string;
    type: InputType;
    placeholder?: string;
    rules?: any[];
    min?: number;
  }[];
};

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

export const DirectExecutionFieldsMap: DirectExecutionFieldsMapType = {
  [ExecutionStep.Setup]: [
    {
      label: "Row TX",
      key: "rowTX",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.isRequired],
    },
    {
      label: "Gas to send with transaction",
      key: "gasToSendWithTransaction",
      type: InputType.Number,
      placeholder: "E.g. 0",
      min: 0,
      rules: [formRules.isPositiveNumber, formRules.isRequired],
    },
    {
      label: "Address of Contract Interaction",
      key: "addressOfContractInteraction",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.isRequired],
    },
    {
      label: "Operations",
      key: "operations",
      type: InputType.Textarea,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isRequired],
    },
  ],

  [ExecutionStep.Details]: [
    {
      label: "Proposal Title",
      key: "proposalTitle",
      type: InputType.Text,
      placeholder: "E.g. Proposal Title",
      rules: [formRules.isRequired],
    },
    {
      label: "Proposal Description",
      key: "proposalDescription",
      type: InputType.Textarea,
      placeholder: "E.g. Proposal Description",
      rules: [formRules.isRequired],
    },
  ],
};
