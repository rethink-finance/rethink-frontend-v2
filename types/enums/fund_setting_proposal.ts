import type { IStepperStep } from "~/types/stepper";
import type { FieldsMapType } from "./stepper";
import { InputType } from "./stepper";

export enum ProposalStep {
  Setup = "setup",
  Details = "details",
}

export enum StepSections {
  Basics = "basic",
  Fees = "fees",
  //   Whitelist = "whitelist",
  Management = "management",
  Governance = "governance",
  Details = "details",
}

// define step map
export const ProposalStepMap: Record<ProposalStep, IStepperStep> = {
  [ProposalStep.Setup]: {
    key: ProposalStep.Setup,
    sections: [
      {
        name: "Basic",
        key: StepSections.Basics,
      },
      {
        name: "Fees",
        key: StepSections.Fees,
      },
      //   {
      //     name: "Whitelist",
      //     key: StepSections.Whitelist,

      //   },
      {
        name: "Management",
        key: StepSections.Management,
      },
      {
        name: "Governance",
        key: StepSections.Governance,

        info: "To create a proposal to change governor framework or change it's settings, please contact rok@rethink.finance",
      },
    ],
  },
  [ProposalStep.Details]: {
    name: "Proposal Details",

    key: ProposalStep.Details,
    sections: [
      {
        name: "Details",
        key: StepSections.Details,
      },
    ],
  },
};

// define fields map
export const FundSettingProposalFieldsMap: FieldsMapType = {
  [StepSections.Basics]: [
    {
      label: "Fund DAO Name",
      key: "fundDAOName",
      type: InputType.Text,
      placeholder: "E.g. Fund DAO Name",
      rules: [formRules.required],
      isEditable: false,
    },
    {
      label: "Token Symbol",
      key: "tokenSymbol",
      type: InputType.Text,
      placeholder: "E.g. Token Symbol",
      rules: [formRules.required],
      isEditable: false,
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
      charLimit: 660,
      rules: [formRules.required, formRules.charLimit(660)],
      isEditable: true,
    },
  ],
  [StepSections.Fees]: [
    {
      isTogglable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Deposit Fee (%)",
          key: "depositFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
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
      isTogglable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Redemption Fee (%)",
          key: "redemptionFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
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
      isTogglable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Management Fee (%)",
          key: "managementFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
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
          label: "Management Fee Period(Days)",
          key: "managementFeePeriod",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
          isEditable: true,
        },
      ],
    },
    {
      isTogglable: true,
      isToggleOn: true,
      fields: [
        {
          label: "Profit Management Fee (%)",
          key: "profitManagemnetFee",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
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
          label: "Profit Management Fee Period(Days)",
          key: "profitManagementFeePeriod",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
          isEditable: true,
        },
        {
          label: "Hurdle Rate (%)",
          key: "hurdleRate",
          type: InputType.Number,
          placeholder: "E.g. 0",
          min: 0,
          rules: [formRules.required, formRules.isPositiveNumber],
          isEditable: true,
        },
      ],
    },
  ],
  //   [StepSections.Whitelist]: [
  //     {
  //       label: "Whitelist",
  //       key: "whitelist",
  //       type: InputType.Textarea,
  //       placeholder: "E.g. Whitelist",
  //       rules: [formRules.required],
  //       isEditable: true,
  //     },
  //   ],
  [StepSections.Management]: [
    {
      label: "Planned Settlemnet Period (Days)",
      key: "plannedSettlementPeriod",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
      isEditable: true,
    },
    {
      label: "Min. Liquid Asset Share (%)",
      key: "minLiquidAssetShare",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
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
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
      isEditable: false,
    },
    {
      label: "Voting Period (in blocks)",
      key: "votingPeriod",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
      isEditable: false,
    },
    {
      label: "Voting Delay (in seconds)",
      key: "votingDelay",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
      isEditable: false,
    },
    {
      title: "Proposal Threshold",
      key: "proposalThreshold",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
      isEditable: false,
    },
    {
      label: "Late Quorum (in seconds)",
      key: "lateQuorum",
      type: InputType.Number,
      placeholder: "E.g. 0",
      rules: [formRules.required, formRules.isPositiveNumber],
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