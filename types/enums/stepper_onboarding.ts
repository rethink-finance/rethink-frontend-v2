
import { InputType } from "./stepper";

export interface IOnboardingStep {
  name?: string;
  info?: string;
  key: OnboardingSteps;
  hasRegularFields: boolean;
}

export enum OnboardingSteps {
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
  profitManagementFeePeriod: string;
  hurdleRate: string;
  plannedSettlementPeriod: string;
  minLiquidAssetShare: string;
  governanceToken: string;
  quorum: string;
  votingPeriod: string;
  votingDelay: string;
  proposalThreshold: string;
  lateQuorum: string;

  // Whitelist
  whitelist: string;
  isWhitelistedDeposits: boolean;
  // Permissions
  permissions: string;
  // Navigation Methods
  navMethods: string;
  // Finalise

}

export interface IFieldGroup {
  isToggleable: boolean;
  isToggleOn: boolean;
  fields: IField[];
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
}

export type FieldsMapType = Record<OnboardingSteps, IField[] | IFieldGroup[]>;


// 1. define OnboardingStepMap with the steps
export const OnboardingStepMap: IOnboardingStep[] = [
  {
    key: OnboardingSteps.Basics,
    name: "Basics",
    hasRegularFields: true,
  },
  {
    key: OnboardingSteps.Fees,
    name: "Fees",
    hasRegularFields: true,
  },
  {
    key: OnboardingSteps.Whitelist,
    name: "Whitelist",
    hasRegularFields: false, // whitelist is a component not a regular field
  },
  {
    key: OnboardingSteps.Management,
    name: "Management",
    hasRegularFields: true,
  },
  {
    key: OnboardingSteps.Governance,
    name: "Governance",
    hasRegularFields: true,
  },
  {
    key: OnboardingSteps.Permissions,
    name: "Permissions",
    hasRegularFields: true, // this may be a component as well
  },
  {
    key: OnboardingSteps.NavMethods,
    name: "Navigation Methods",
    hasRegularFields: false, // this may be a component as well
  },
  {
    key: OnboardingSteps.Finalise,
    name: "Finalise",
    hasRegularFields: false, // this is last step, no fields here
  },
]


// 2. define the fields for each section
export const OnboardingFieldsMap: FieldsMapType = {
  [OnboardingSteps.Basics]: [
    {
      label: "Photo URL",
      key: "photoUrl",
      type: InputType.Image,
      placeholder: "",
      isEditable: true,
      rules: [formRules.required],
      cols: 12,
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
      info: "To change Denomination Asset, please contact rok@rethink.finance",
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
  [OnboardingSteps.Fees]: [
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
        {
          label: "Performance Fee Period (Days)",
          key: "profitManagementFeePeriod",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 12,
        },
      ],
    },
  ],
  [OnboardingSteps.Whitelist]: [
    {
      label: "Whitelist",
      key: "whitelist",
      type: InputType.Textarea,
      placeholder: "E.g. 0",
    },
  ],
  [OnboardingSteps.Management]: [
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
  [OnboardingSteps.Governance]: [
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
  [OnboardingSteps.Permissions]: [
    {
      label: "Permissions",
      key: "permissions",
      type: InputType.Textarea,
      placeholder: "E.g. Permissions",
      rules: [formRules.required],
      isEditable: true,
    },
  ],
  [OnboardingSteps.NavMethods]: [
    {
      label: "Navigation Methods",
      key: "navMethods",
      type: InputType.Textarea,
      placeholder: "E.g. Navigation Methods",
      rules: [formRules.required],
      isEditable: true,
    },
  ],
  [OnboardingSteps.Finalise]: [],

};


