import {
  FundSettingsStepFieldsMap,
  StepSections,
} from "~/types/enums/fund_setting_proposal";
import type { IField, IFieldGroup } from "~/types/enums/input_type";

export enum OnboardingStep {
    Chain = "chain",
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

export type OnboardingInitializingSteps = Exclude<OnboardingStep, "chain" | "management" | "permissions" | "navMethods" | "whitelist" | "finalize">;
export type FieldsMapType = Record<OnboardingInitializingSteps, IField[] | IFieldGroup[]>;


// 1. define OnboardingStepMap with the steps
export const OnboardingStepMap: IOnboardingStep[] = [
  {
    key: OnboardingStep.Chain,
    name: "Chain",
  },
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
// TODO rename to CreateFundStepFieldsMap
const OnboardingFieldsMap: FieldsMapType = {
  [OnboardingStep.Basics]: [
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
    ...(FundSettingsStepFieldsMap[StepSections.Management] as IField[]).map(
      (field: IField) => {
        // Hide some fields.
        const fieldsToHide = [ "minLiquidAssetShare"]

        if (fieldsToHide.includes(field.key)) return undefined

        // override for minLiquidAssetShare
        if(field.key === "plannedSettlementPeriod") {
          return {
            ...field,
            isEditable: true,
            info: "Please note that <strong>Planned Settlement Period</strong> is not enforced on-chain. Your job as a manager is to make sure OIV is managed accordingly to these parameters. Your management role may otherwise be removed through governance.",
          }
        }

        return {
          ...field,
          isEditable: true,
        };
      },
    ).filter((field) => field),
  ] as (IField[] | IFieldGroup[]),
  [OnboardingStep.Fees]: (FundSettingsStepFieldsMap[StepSections.Fees] as IFieldGroup[]).map(
    (fieldGroup: IFieldGroup) => {
      // fields to exclude
      const fieldsToHide = ["performanceFeePeriod"];

      return {
        ...fieldGroup,
        isToggleOn: false,
        fields: fieldGroup.fields
          .filter((field: IField) => !fieldsToHide.includes(field.key))
          .map(
            (field: IField) => ({
              ...field,
              isEditable: true,
            }),
          ),
      };
    },
  ),
  // Take Governance fields and make them editable when creating new fund.
  [OnboardingStep.Governance]: (FundSettingsStepFieldsMap[StepSections.Governance] as IField[]).map(
    (field: IField) => {

      // add default value for governanceToken if it's toggled off
      if (field.key === "governanceToken") {
        return {
          ...field,
          label: "Custom Governance Token",
          isEditable: true,
          isCustomValueToggleOn: false, // this is used to determine if the value is custom or default
          defaultValue: "0x0000000000000000000000000000000000000000",
          defaultValueInfo: "By default OIV Token is used as the Governance Token for the OIV.",
        }
      }

      return {
        ...field,
        isEditable: true,
      }
    },
  ),
};

export { OnboardingFieldsMap };

