import { networks } from "~/store/web3/networksMap";
import {
  FundSettingsStepFieldsMap,
  StepSections,
} from "~/types/enums/fund_setting_proposal";
import type { IField, IFieldGroup } from "~/types/enums/input_type";
import { InputType } from "~/types/enums/input_type";
import type INetwork from "~/types/network";

export enum OnboardingStep {
    Basics = "basics",
    Fees = "fees",
    Whitelist = "whitelist",
    Management = "management",
    Governance = "governance",
    Permissions = "permissions",
    NavMethods = "navMethods",
    Finalize = "finalize",
}

export interface IOnboardingStep {
  name?: string;
  key: OnboardingStep;
  info?: string;
  fields?: IField[];
}

export type OnboardingInitializingSteps = Exclude<OnboardingStep, "permissions" | "navMethods" | "whitelist" | "finalize">;
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
    key: OnboardingStep.Finalize,
    name: "Finalize",
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
    // Take Basic fields and make them editable when creating new fund.
    ...(FundSettingsStepFieldsMap[StepSections.Basics]).map(
      (field) => {
        return  {
          ...field,
          isEditable: true,
          info: "",
        }
      },
    ),
  ] as (IField[] | IFieldGroup[]),
  [OnboardingStep.Fees]: (FundSettingsStepFieldsMap[StepSections.Fees] as IFieldGroup[]).map(
    (fieldGroup: IFieldGroup) => {
      // fields to exclude
      const blacklist = ["performanceFeePeriod"];

      return {
        ...fieldGroup,
        fields: fieldGroup.fields
          .filter((field: IField) => !blacklist.includes(field.key))
          .map(
            (field: IField) => ({
              ...field,
              isEditable: true,
            }),
          ),
      };
    },
  ),
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

export { OnboardingFieldsMap };

