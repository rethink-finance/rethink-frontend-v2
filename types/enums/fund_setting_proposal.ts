import type { IField, IFieldGroup } from "~/types/enums/input_type";
import { InputType, periodChoices } from "~/types/enums/input_type";

const FeesDocs = "https://docs.rethink.finance/rethink.finance/protocol/architecture/admin-contract/fees"

export enum ProposalStep {
  Setup = "setup",
  Details = "details",
}

export enum StepSections {
  Basics = "basic",
  Fee = "fee",
  Whitelist = "whitelist",
  Management = "management",
  Governance = "governance",
  Details = "details",
}

export interface IStepperSection {
  name: string;
  key: StepSections;
  info?: string;
}

export interface IFundSettingProposalStep {
  name?: string;
  key: ProposalStep;
  sections: IStepperSection[];
}

export interface IProposal {
  [key: string]: string | boolean; // Add index signature
  photoUrl: string;
  fundName: string;
  fundSymbol: string;
  baseToken: string;
  description: string;
  depositFee: string;
  depositFeeRecipientAddress: string;
  withdrawFee: string;
  withdrawFeeRecipientAddress: string;
  managementFee: string;
  managementFeeRecipientAddress: string;
  managementFeePeriod: string;
  performanceFee: string;
  performanceFeeRecipientAddress: string;
  performanceFeePeriod: string;
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

export type FieldsMapType = Record<StepSections, IField[] | IFieldGroup[]>;


// 1. define FundSettingsStepsMap which maps each proposal step to its corresponding sections
export const FundSettingsStepsMap: Record<ProposalStep, IFundSettingProposalStep> = {
  [ProposalStep.Setup]: {
    key: ProposalStep.Setup,
    sections: [
      {
        name: "Basic",
        key: StepSections.Basics,
      },
      { name: "Fee",
        key: StepSections.Fee,
        info: `<span>Please find more about details about fees and alternative fee types in our <a target='_blank' href='${FeesDocs}'>documentation.</a></span>`,
      },
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

export const feeFieldKeys = [
  "depositFee",
  "withdrawFee",
  "managementFee",
  "performanceFee",
]

export const baseTokenSymbolField =     {
  label: "Symbol",
  key: "baseTokenSymbol",
  type: InputType.Text,
  isEditable: false,
}
export const baseTokenDecimalsField =     {
  label: "Decimals",
  key: "baseTokenDecimals",
  type: InputType.Text,
  isEditable: false,
}

// 2. define FundSettingsStepFieldsMap which holds the form fields for each section
// TODO instead of doing this manually, each field should have here defined function to serialize and deserialize.
//   for example fee fields are shown in the UI as Number(fromPercentageToBps(
export const FundSettingsStepFieldsMap: FieldsMapType = {
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
      label: "OIV Name",
      key: "fundName",
      type: InputType.Text,
      placeholder: "E.g. OIV Name",
      rules: [formRules.required],
      isEditable: false,
      cols: 6,
    },
    {
      label: "OIV Token Symbol",
      tooltip: "Token ticker representing the tokenized shares of your OIV.",
      key: "fundSymbol",
      type: InputType.Text,
      placeholder: "E.g. ETH",
      rules: [formRules.required],
      isEditable: false,
      cols: 6,
    },
    {
      label: "Denomination Asset Address",
      key: "baseToken",
      type: InputType.Text,
      tooltip: "Asset is used for deposits and measuring share price.",
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
  [StepSections.Fee]: [
    {
      isToggleable: true,
      isToggleOn: true,
      groupName: "Deposit Fee",
      tooltip: "Share of deposited denomination asset.",
      fields: [
        {
          label: "Deposit Fee (%)",
          key: "depositFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 4,
        },
        {
          label: "Recipient Address",
          key: "depositFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
          cols: 8,
        },
      ],
    },
    {
      isToggleable: true,
      isToggleOn: true,
      groupName: "Redemption Fee",
      tooltip: "Share of redeemed denomination asset.",
      fields: [
        {
          label: "Redemption Fee (%)",
          key: "withdrawFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 4,
        },
        {
          label: "Recipient Address",
          key: "withdrawFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
          cols: 8,
        },
      ],
    },
    {
      isToggleable: true,
      isToggleOn: true,
      groupName: "Management Fee",
      tooltip: "Share of minted OIV tokens per management fee period.",
      fields: [
        {
          label: "Management Fee (%)",
          key: "managementFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 4,
        },
        {
          label: "Recipient Address",
          key: "managementFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
          cols: 8,
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
      groupName: "Performance Fee",
      tooltip: "Profit share in minted OIV tokens.",
      fields: [
        {
          label: "Performance Fee (%)",
          key: "performanceFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isNonNegativeNumber],
          isEditable: true,
          cols: 4,
        },
        {
          label: "Recipient Address",
          key: "performanceFeeRecipientAddress",
          type: InputType.Text,
          placeholder: "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          rules: [formRules.isValidAddress, formRules.required],
          isEditable: true,
          cols: 8,
        },
        {
          label: "Performance Fee Period (Days)",
          key: "performanceFeePeriod",
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
      label: "Planned Settlement Period",
      key: "plannedSettlementPeriod",
      tooltip: "Frequency of settling deposit and redemtion requests.",
      type: InputType.Period,
      choices: periodChoices,
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
      tooltip: "TBD Use any existing ERC20 token",
    },
    {
      label: "Quorum (%)",
      key: "quorum",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
      tooltip: "Required minimum participation form total token supply.",
    },
    {
      label: "Voting Period",
      key: "votingPeriod",
      type: InputType.Period,
      choices: periodChoices,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
      tooltip: "Amount of time available for voting.",
    },
    {
      label: "Voting Delay",
      key: "votingDelay",
      type: InputType.Period,
      choices: periodChoices,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
      tooltip: "Delay between proposal creation and start of the voting period.",
    },
    {
      label: "Proposal Threshold",
      key: "proposalThreshold",
      type: InputType.Text,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
      tooltip: "Minimum required OIV tokens to create a proposal.",
    },
    {
      label: "Late Quorum",
      key: "lateQuorum",
      type: InputType.Period,
      placeholder: "E.g. 0",
      rules: [formRules.required],
      isEditable: false,
      tooltip: "Amount of time required for porposal to pass, after it reaches quorom.",
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
