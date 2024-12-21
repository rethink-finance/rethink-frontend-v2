import { networks } from "~/store/web3/networksMap";
import type INetwork from "~/types/network";
import { InputType } from "~/types/enums/input_type";
import {
  FundSettingsStepFieldsMap,
  StepSections,
} from "~/types/enums/fund_setting_proposal";
import type { IField, IFieldGroup } from "~/types/enums/input_type";

export enum OnboardingStep {
    Basics = "basics",
    Fees = "fees",
    Whitelist = "whitelist",
    Management = "management",
    Governance = "governance",
    Permissions = "permissions",
    NavMethods = "navMethods",
    Finalise = "finalise",
}

export interface IOnboardingStep {
  name?: string;
  key: OnboardingStep;
  info?: string;
  fields?: IField[];
}

export type OnboardingInitializingSteps = Exclude<OnboardingStep, "permissions" | "navMethods" | "whitelist" | "finalise">;
export type FieldsMapType = Record<OnboardingInitializingSteps, IField[] | IFieldGroup[]>;


// 1. define OnboardingStepMap with the steps
export const OnboardingStepMap: IOnboardingStep[] = [
  {
    key: OnboardingStep.Basics,
    name: "Basics",
  },
  {
    key: OnboardingStep.Fees,
    name: "Fees",
  },
  {
    key: OnboardingStep.Whitelist,
    name: "Whitelist",
  },
  {
    key: OnboardingStep.Management,
    name: "Management",
  },
  {
    key: OnboardingStep.Governance,
    name: "Governance",
  },
  {
    key: OnboardingStep.Permissions,
    name: "Permissions",
  },
  {
    key: OnboardingStep.NavMethods,
    name: "NAV Methods",
  },
  {
    key: OnboardingStep.Finalise,
    name: "Finalise",
  },
]


// 2. define the fields for each section
const chainIdField: IField = {
  label: "Fund Chain",
  key: "chainId",
  type: InputType.Select,
  placeholder: "",
  rules: [formRules.required],
  isEditable: true,
  cols: 3,
  choices: networks.map((network: INetwork) => (
    {
      value: network.chainId,
      title: network.chainName,
    }
  )),
};

// TODO rename to CreateFundStepFieldsMap
const OnboardingFieldsMap: FieldsMapType = {
  [OnboardingStep.Basics]: [
    chainIdField,
    ...FundSettingsStepFieldsMap[StepSections.Basics],
  ] as (IField[] | IFieldGroup[]),
  [OnboardingStep.Fees]: FundSettingsStepFieldsMap[StepSections.Fees],
  [OnboardingStep.Management]: FundSettingsStepFieldsMap[StepSections.Management],
  // Take Governance fields and make them editable when creating new fund.
  [OnboardingStep.Governance]: (FundSettingsStepFieldsMap[StepSections.Governance] as IField[]).map(
    (field: IField) => (
      {
        ...field,
        isEditable: true,
      }
    ),
  ),
};

export { OnboardingFieldsMap }
