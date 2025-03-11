import {
  FundSettingsStepFieldsMap,
  StepSections,
} from "~/types/enums/fund_setting_proposal";
import type { IField, IFieldGroup } from "~/types/enums/input_type";

const FeesDocs = "https://docs.rethink.finance/rethink.finance/protocol/architecture/admin-contract/fees"


export enum OnboardingStep {
    Chain = "chain",
    Basics = "basics",
    Fee = "fee",
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
    key: OnboardingStep.Fee,
    info: `<span>Please find more about details about fees and alternative fee types in our <a target='_blank' href='${FeesDocs}'>documentation.</a></span>`,
    name: "Fee",
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
    ...(FundSettingsStepFieldsMap[StepSections.Basics] as IField[]).map(
      (field) => {
        const isEditableAfterCreating = field.isEditable;

        return  {
          ...field,
          isEditable: true,
          info: "",
          tag: isEditableAfterCreating ? "upgradable" : "fixed",
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
            tag: "upgradable",
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
  [OnboardingStep.Fee]: (FundSettingsStepFieldsMap[StepSections.Fee] as IFieldGroup[]).map(
    (fieldGroup: IFieldGroup) => {
      // fields to exclude
      const fieldsToHide = ["performanceFeePeriod"];

      return {
        ...fieldGroup,
        isToggleOn: false,
        fields: fieldGroup.fields
          .filter((field: IField) => !fieldsToHide.includes(field.key))
          .map(
            (field: IField) => {
              const isEditableAfterCreating = field.isEditable;

              return {
                ...field,
                isEditable: true,
                tag: isEditableAfterCreating ? "upgradable" : "fixed",

              }
            },
          ),
      };
    },
  ),
  // Take Governance fields and make them editable when creating new fund.
  [OnboardingStep.Governance]: (FundSettingsStepFieldsMap[StepSections.Governance] as IField[]).map(
    (field: IField) => {
      const isEditableAfterCreating = field.isEditable;

      // add default value for governanceToken if it's toggled off
      if (field.key === "governanceToken") {
        return {
          ...field,
          label: "Custom Governance Token",
          tag: isEditableAfterCreating ? "upgradable" : "fixed",
          isEditable: true,
          isCustomValueToggleOn: false, // this is used to determine if the value is custom or default
          defaultValue: "0x0000000000000000000000000000000000000000",
          defaultValueInfo: "By default OIV Token is used as the Governance Token for the OIV.",
        }
      }

      return {
        ...field,
        tag: isEditableAfterCreating ? "upgradable" : "fixed",
        isEditable: true,
      }
    },
  ),
};

export { OnboardingFieldsMap };

