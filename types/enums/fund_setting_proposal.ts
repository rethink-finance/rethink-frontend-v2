import { InputType } from "./stepper";

export interface IFundSettingProposalStep {
  name?: string;
  key: ProposalStep;
  sections: IStepperSection[];
}

export interface IStepperSection {
  name: string;
  key: StepSections;
  info?: string;
}

export interface IProposal {
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
  proposalTitle: string;
  proposalDescription: string;
  whitelist: string;
  isWhitelistedDeposits: boolean;
}

export interface IWhitelist {
  address: string;
  deleted: boolean;
  isNew: boolean;
}

export interface IField {
  label: string;
  key: keyof IProposal;
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

export interface IFieldGroup {
  isToggleable: boolean;
  isToggleOn: boolean;
  fields: IField[];
}

export type FieldsMapType = Record<StepSections, IField[] | IFieldGroup[]>;

export enum ProposalStep {
  Setup = "setup",
  Details = "details",
}

export enum StepSections {
  Basics = "basic",
  Fees = "fees",
  Whitelist = "whitelist",
  Management = "management",
  Governance = "governance",
  Details = "details",
}

// 1. define ProposalStepMap which maps each proposal step to its corresponding sections
export const ProposalStepMap: Record<ProposalStep, IFundSettingProposalStep> = {
  [ProposalStep.Setup]: {
    key: ProposalStep.Setup,
    sections: [
      {
        name: "Basic",
        key: StepSections.Basics,
      },
      { name: "Fees", key: StepSections.Fees },
      { name: "Whitelist", key: StepSections.Whitelist },
      { name: "Management", key: StepSections.Management },
      {
        name: "Governance",
        key: StepSections.Governance,
        info: "To create a proposal to change the governor framework or its settings, please contact rok@rethink.finance",
      },
    ],
  },
  [ProposalStep.Details]: {
    name: "Proposal Details",
    key: ProposalStep.Details,
    sections: [{ name: "Details", key: StepSections.Details }],
  },
};

// 2. define FundSettingProposalFieldsMap which holds the form fields for each section
export const FundSettingProposalFieldsMap: FieldsMapType = {
  [StepSections.Basics]: [
    {
      label: "Photo URL",
      key: "photoUrl",
      type: InputType.Image,
      placeholder: "",
      rules: [formRules.required],
      isEditable: true,
      cols: 12,
    },
    {
      label: "OIV DAO Name",
      key: "fundDAOName",
      type: InputType.Text,
      placeholder: "E.g. OIV DAO Name",
      rules: [formRules.required],
      isEditable: false,
      cols: 6,
    },
    {
      label: "Token Symbol",
      key: "tokenSymbol",
      type: InputType.Text,
      placeholder: "E.g. Token Symbol",
      rules: [formRules.required],
      isEditable: false,
      cols: 6,
    },
    {
      label: "Denomination Asset",
      key: "denominationAsset",
      type: InputType.Text,
      placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      rules: [formRules.isValidAddress, formRules.required],
      isEditable: false,
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
  [StepSections.Fees]: [
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
  [StepSections.Whitelist]: [
    {
      label: "Whitelist",
      key: "whitelist",
      type: InputType.Textarea,
      placeholder: "E.g. 0",
    },
  ],
  [StepSections.Management]: [
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
  [StepSections.Governance]: [
    {
      label: "Governance Token",
      key: "governanceToken",
      type: InputType.Text,
      placeholder: "E.g. Governance Token",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Quorum (%)",
      key: "quorum",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Voting Period (in blocks)",
      key: "votingPeriod",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Voting Delay (in seconds)",
      key: "votingDelay",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Proposal Threshold",
      key: "proposalThreshold",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Late Quorum (in seconds)",
      key: "lateQuorum",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
    },
  ],
  [StepSections.Details]: [
    {
      label: "Proposal Title",
      key: "proposalTitle",
      type: InputType.Text,
      placeholder: "E.g. Proposal Title",
      charLimit: 150,
      rules: [formRules.required, formRules.charLimit(150)],
      isEditable: true,
    },
    {
      label: "Proposal Description",
      key: "proposalDescription",
      type: InputType.Textarea,
      placeholder: "E.g. Proposal Description",
      charLimit: 660,
      rules: [formRules.required, formRules.charLimit(660)],
      isEditable: true,
    },
  ],
};
