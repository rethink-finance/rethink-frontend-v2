
import { networks } from "~/store/web3/networksMap";
import type INetwork from "~/types/network";
import { InputType } from "./stepper";

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

export interface IOnboardingForm {
  chainId: string;
  photoUrl: string;
  fundDAOName: string;
  tokenSymbol: string;
  denominationAsset: string;
  description: string;
  depositFee: string;
  depositFeeRecipientAddress: string;
  redemptionFee: string;
  redemptionFeeRecipientAddress: string;
  managementFee: string;
  managementFeeRecipientAddress: string;
  managementFeePeriod: string;
  profitManagemnetFee: string;
  profitManagemnetFeeRecipientAddress: string;
  hurdleRate: string;
  plannedSettlementPeriod: string;
  minLiquidAssetShare: string;
  governanceToken: string;
  quorum: string;
  votingPeriod: string;
  votingDelay: string;
  proposalThreshold: string;
  lateQuorum: string;

  // TODO: remove this
  // // Whitelist
  // whitelist: string;
  // isWhitelistedDeposits: boolean;

}

export interface IField {
  label: string;
  key: keyof IOnboardingForm;
  type: InputType;
  placeholder: string;
  rules?: any[];
  isEditable?: boolean;
  cols?: number;
  min?: number;
  charLimit?: number;
  info?: string;
  isToggleable?: boolean;
  isToggleOn?: boolean;
  fields?: IField[];
  title?: string;
  value?: string | boolean;
  choices?: any[],
}

export interface IOnboardingStep {
  name?: string;
  key: OnboardingStep;
  info?: string;
  fields?: IField[];
  hasRegularFields: boolean;
}

export interface IFieldGroup {
  isToggleable: boolean;
  isToggleOn: boolean;
  fields: IField[];
}

export type OnboardingInitializingSteps = Exclude<OnboardingStep, "permissions" | "navMethods" | "whitelist" | "finalise">;
export type FieldsMapType = Record<OnboardingInitializingSteps, IField[] | IFieldGroup[]>;


// 1. define OnboardingStepMap with the steps
export const OnboardingStepMap: IOnboardingStep[] = [
  {
    key: OnboardingStep.Basics,
    name: "Basics",
    hasRegularFields: true,
  },
  {
    key: OnboardingStep.Fees,
    name: "Fees",
    hasRegularFields: true,
  },
  {
    key: OnboardingStep.Whitelist,
    name: "Whitelist",
    hasRegularFields: false, // whitelist is a component not a regular field
  },
  {
    key: OnboardingStep.Management,
    name: "Management",
    hasRegularFields: true,
  },
  {
    key: OnboardingStep.Governance,
    name: "Governance",
    hasRegularFields: true,
  },
  {
    key: OnboardingStep.Permissions,
    name: "Permissions",
    hasRegularFields: false, // this is a component not a regular field
  },
  {
    key: OnboardingStep.NavMethods,
    name: "NAV Methods",
    hasRegularFields: false, // this may be a component as well
  },
  {
    key: OnboardingStep.Finalise,
    name: "Finalise",
    hasRegularFields: false, // this is last step, no fields here
  },
]


// 2. define the fields for each section
export const OnboardingFieldsMap: FieldsMapType = {
  [OnboardingStep.Basics]: [
    {
      label: "Photo URL",
      key: "photoUrl",
      type: InputType.Image,
      placeholder: "",
      rules: [formRules.required],
      isEditable: true,
      cols: 9,
    },
    {
      label: "Chain",
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
    },
    {
      label: "OIV DAO Name",
      key: "fundDAOName",
      type: InputType.Text,
      placeholder: "E.g. OIV DAO Name",
      rules: [formRules.required],
      isEditable: true,
      cols: 6,
    },
    {
      label: "Token Symbol",
      key: "tokenSymbol",
      type: InputType.Text,
      placeholder: "E.g. Token Symbol",
      rules: [formRules.required],
      isEditable: true,
      cols: 6,
    },
    {
      label: "Denomination Asset",
      key: "denominationAsset",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.required],
      isEditable: true,

    },
    {
      label: "Description",
      key: "description",
      type: InputType.Textarea,
      placeholder: "E.g. Description",
      charLimit: 5000,
      rules: [formRules.required, formRules.charLimit(5000)],
      isEditable: true,
    },
  ],
  [OnboardingStep.Fees]: [
    {
      isToggleable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Deposit Fee (%)",
          key: "depositFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
        },
        {
          label: "Recipient Address",
          key: "depositFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
        },
      ],
    },
    {
      isToggleable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Redemption Fee (%)",
          key: "redemptionFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
        },
        {
          label: "Recipient Address",
          key: "redemptionFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
        },
      ],
    },
    {
      isToggleable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Management Fee (%)",
          key: "managementFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
        },
        {
          label: "Recipient Address",
          key: "managementFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
        },
        {
          label: "Management Fee Period (Days)",
          key: "managementFeePeriod",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 12,
        },
      ],
    },
    {
      isToggleable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Performance Fee (%)",
          key: "profitManagemnetFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
        },
        {
          label: "Recipient Address",
          key: "profitManagemnetFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
        },
      ],
    },
  ],
  // [OnboardingStep.Whitelist]: [
  //   {
  //     label: "Whitelist",
  //     key: "whitelist",
  //     type: InputType.Textarea,
  //     placeholder: "E.g. 0",
  //   },
  // ],
  [OnboardingStep.Management]: [
    {
      label: "Planned Settlement Period (Days)",
      key: "plannedSettlementPeriod",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isNonNegativeNumber],
      isEditable: true,
    },
    {
      label: "Min. Liquid Asset Share (%)",
      key: "minLiquidAssetShare",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isNonNegativeNumber],
      isEditable: true,
    },
  ],
  [OnboardingStep.Governance]: [
    {
      label: "Governance Token",
      key: "governanceToken",
      type: InputType.Text,
      placeholder: "E.g. Governance Token",
      rules: [formRules.required],
      isEditable: true,
    },
    {
      label: "Quorum (%)",
      key: "quorum",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: true,
    },
    {
      label: "Voting Period (in blocks)",
      key: "votingPeriod",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: true,
    },
    {
      label: "Voting Delay (in seconds)",
      key: "votingDelay",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: true,
    },
    {
      label: "Proposal Threshold",
      key: "proposalThreshold",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: true,
    },
    {
      label: "Late Quorum (in seconds)",
      key: "lateQuorum",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: true,
    },
  ],
};


