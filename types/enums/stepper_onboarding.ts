import { ethers } from "ethers";
import {
  FundSettingsStepFieldsMap,
  StepSections,
} from "~/types/enums/fund_setting_proposal";
import { ChainId } from "~/types/enums/chain_id";
import type { IField, IFieldGroup } from "~/types/enums/input_type";

export const FeesDocs = "https://docs.rethink.finance/rethink.finance/protocol/architecture/admin-contract/fees"

/**
 * Chip vocabulary for the create flow. Every field declares which one it gets:
 * `Fixed` is immutable once the vault is initialized, the two `Upgradable`
 * values name who can change it afterwards. Rendered by OnboardingFieldChip.
 *
 * Carried on `IField.tag`, which is written nowhere else in the app — the
 * governance fund-settings proposal reads the same field definitions but
 * builds them from FundSettingsStepFieldsMap without ever setting a tag.
 */
export enum FieldTag {
  Fixed = "fixed",
  UpgradableCurator = "upgradable-curator",
  UpgradableGovernance = "upgradable-governance",
}

export enum OnboardingStep {
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

export type OnboardingInitializingSteps = Exclude<OnboardingStep, "management" | "permissions" | "navMethods" | "whitelist" | "finalize">;
export type FieldsMapType = Record<OnboardingInitializingSteps, IField[] | IFieldGroup[]>;


// 1. define OnboardingStepMap with the steps
/**
 * The seven visible steps. Chain used to be a step of its own; it is now the
 * first half of Basics, since picking a network and naming the vault are one
 * decision — the chain is what the name, the asset and the draft all hang off.
 */
export const OnboardingStepMap: IOnboardingStep[] = [
  {
    key: OnboardingStep.Basics,
    name: "Basics",
  },
  {
    key: OnboardingStep.Fee,
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

/**
 * Base assets offered per chain, in the order the picker lists them.
 *
 * These are the same addresses networksMap resolves symbols and icons for, so
 * every entry here renders with a mark and a ticker; anything else the user
 * wants is reachable through the picker's "Custom address" option. Kept beside
 * the rest of the create-flow configuration rather than in the network map,
 * which is only ever read for the chain list and the icons.
 */
export const OnboardingBaseAssets: Partial<Record<ChainId, string[]>> = {
  [ChainId.ETHEREUM]: [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
  ],
  [ChainId.BASE]: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0x4200000000000000000000000000000000000006", // WETH
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
  ],
  [ChainId.POLYGON]: [
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  ],
  [ChainId.ARBITRUM]: [
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
  ],
  [ChainId.HYPEREVM]: [
    "0xB88339CB7199b77E23DB6E890353E22632Ba630f", // USDC
    "0xBe6727B535545C67d5cAa73dEa54865B92CF7907", // WETH
    "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463", // WBTC
  ],
};

/**
 * The Basics step, in the order the design lays it out: Setup — the network,
 * the asset and what the vault and its share token are called — then Vault
 * profile, how the vault presents itself.
 *
 * Assembled by key rather than by walking the source arrays, so the order here
 * is the order on screen and a field that moves in the proposal form does not
 * silently move in the create flow. `minLiquidAssetShare` is left out by
 * omission — it is collected nowhere in this flow.
 */
const BASICS_FIELD_ORDER = [
  "baseToken",
  "fundName",
  "fundSymbol",
  "photoUrl",
  "description",
  "plannedSettlementPeriod",
  "strategistName",
  "strategistUrl",
  "oivChatUrl",
];

/**
 * Per-field overrides for the create flow. `tooltip` is the helper line the
 * design prints under a field, not a hover target; `cols` is the span in the
 * step's twelve-column grid.
 */
const BASICS_FIELD_OVERRIDES: Record<string, Partial<IField>> = {
  baseToken: {
    label: "Underlying asset",
    placeholder: "0x0000000000000000000000000000000000000000",
    tag: FieldTag.Fixed,
    rules: [formRules.required, formRules.isValidAddress],
    tooltip: "",
    cols: 6,
  },
  photoUrl: {
    label: "Vault image",
    tag: FieldTag.UpgradableCurator,
    rules: [formRules.required],
    cols: 12,
  },
  fundName: {
    label: "Vault name",
    placeholder: "E.g. vault Name",
    tag: FieldTag.Fixed,
    cols: 6,
  },
  fundSymbol: {
    label: "Vault token symbol",
    placeholder: "E.g. ETH",
    tooltip: "Token ticker representing the tokenized shares of your vault.",
    tag: FieldTag.Fixed,
    cols: 6,
  },
  description: {
    label: "Description",
    placeholder: "E.g. Description",
    tag: FieldTag.UpgradableCurator,
    cols: 12,
  },
  plannedSettlementPeriod: {
    label: "Planned settlement period",
    tag: FieldTag.UpgradableGovernance,
    tooltip:
      "Frequency of settling deposit and redemption requests. Planned settlement period is not enforced on-chain — your job as a manager is to run the vault to these parameters. Your management role may otherwise be removed through governance.",
    cols: 12,
  },
  strategistName: {
    label: "Strategist name",
    placeholder: "E.g. rethink.finance",
    tooltip: "Displayed next to the vault name.",
    tag: FieldTag.UpgradableCurator,
    rules: [formRules.required],
    cols: 6,
  },
  strategistUrl: {
    label: "Strategist link",
    placeholder: "E.g. https://rethink.finance",
    tooltip: "Strategist name becomes clickable and redirects here.",
    tag: FieldTag.UpgradableCurator,
    rules: [formRules.required],
    cols: 6,
  },
  oivChatUrl: {
    label: "Vault chat link",
    placeholder: "E.g. https://discord.com/channels/945238616408481833",
    tooltip: "",
    tag: FieldTag.UpgradableCurator,
    rules: [],
    cols: 12,
  },
};

/**
 * Fee groups in the order the design stacks them, keyed by the percentage
 * field each one carries. The source map orders them deposit-first.
 */
const FEE_GROUP_ORDER = [
  "performanceFee",
  "managementFee",
  "depositFee",
  "withdrawFee",
];

const FEE_GROUP_LABELS: Record<string, string> = {
  performanceFee: "Performance fee",
  managementFee: "Management fee",
  depositFee: "Deposit fee",
  withdrawFee: "Redemption fee",
};

const FEE_FIELD_LABELS: Record<string, string> = {
  performanceFee: "Performance fee (%)",
  managementFee: "Management fee (%)",
  depositFee: "Deposit fee (%)",
  withdrawFee: "Redemption fee (%)",
  performanceFeeRecipientAddress: "Recipient address",
  managementFeeRecipientAddress: "Recipient address",
  depositFeeRecipientAddress: "Recipient address",
  withdrawFeeRecipientAddress: "Recipient address",
};

const GOVERNANCE_FIELD_ORDER = [
  "governanceToken",
  "quorum",
  "proposalThreshold",
  "votingPeriod",
  "votingDelay",
  "lateQuorum",
];

const GOVERNANCE_FIELD_OVERRIDES: Record<string, Partial<IField>> = {
  governanceToken: {
    label: "Governance token address",
    placeholder: "0x0000000000000000000000000000000000000000",
    tag: FieldTag.Fixed,
    rules: [formRules.required, formRules.isValidAddress],
    tooltip: "",
    // Off means the vault token governs, which the contract reads as the zero
    // address. Only the "custom token" model turns this on.
    isCustomValueToggleOn: false,
    defaultValue: ethers.ZeroAddress,
    cols: 12,
  },
  quorum: {
    label: "Quorum (%)",
    tag: FieldTag.Fixed,
    tooltip: "Required minimum participation from total token supply.",
    cols: 6,
  },
  proposalThreshold: {
    label: "Proposal threshold",
    tag: FieldTag.Fixed,
    tooltip: "Minimum vault tokens required to create a proposal.",
    cols: 6,
  },
  votingPeriod: {
    label: "Voting period",
    tooltip: "Time available for voting.",
    cols: 4,
  },
  votingDelay: {
    label: "Voting delay",
    tooltip: "Delay between proposal creation and voting start.",
    cols: 4,
  },
  lateQuorum: {
    label: "Late quorum",
    tooltip: "Time a proposal still needs after it reaches quorum.",
    cols: 4,
  },
};

const pickField = (
  source: IField[],
  key: string,
  overrides: Record<string, Partial<IField>>,
): IField => {
  const field = source.find((f: IField) => f.key === key);

  if (!field) {
    // A key that no longer exists in the source map is a build-time mistake,
    // not something a user can hit; fail loudly rather than render a blank.
    throw new Error(`Onboarding field "${key}" is missing from the settings map.`);
  }

  return {
    ...field,
    // Everything is editable while creating; the flow locks the whole step
    // once the vault is initialized instead of locking field by field.
    isEditable: true,
    info: "",
    ...overrides[key],
  } as IField;
};

// 2. define the fields for each section
// TODO rename to CreateFundStepFieldsMap
const OnboardingFieldsMap: FieldsMapType = {
  [OnboardingStep.Basics]: BASICS_FIELD_ORDER.map((key) =>
    pickField(
      [
        ...(FundSettingsStepFieldsMap[StepSections.Basics] as IField[]),
        ...(FundSettingsStepFieldsMap[StepSections.Management] as IField[]),
      ],
      key,
      BASICS_FIELD_OVERRIDES,
    ),
  ),
  [OnboardingStep.Fee]: FEE_GROUP_ORDER.map((feeKey: string) => {
    const groups = FundSettingsStepFieldsMap[StepSections.Fee] as IFieldGroup[];
    const group = groups.find((g: IFieldGroup) =>
      g.fields.some((field: IField) => field.key === feeKey),
    );

    if (!group) {
      throw new Error(`Onboarding fee group "${feeKey}" is missing from the settings map.`);
    }

    // Collected nowhere in this flow — the contract is sent 0 for it.
    const fieldsToHide = ["performanceFeePeriod"];

    return {
      ...group,
      label: FEE_GROUP_LABELS[feeKey],
      // Every fee starts off; a vault charging nothing is the common case.
      isToggleOn: false,
      tag: FieldTag.UpgradableGovernance,
      fields: group.fields
        .filter((field: IField) => !fieldsToHide.includes(field.key))
        .map((field: IField) => ({
          ...field,
          label: FEE_FIELD_LABELS[field.key] ?? field.label,
          isEditable: true,
        })),
    };
  }) as IFieldGroup[],
  [OnboardingStep.Governance]: GOVERNANCE_FIELD_ORDER.map((key) =>
    pickField(
      FundSettingsStepFieldsMap[StepSections.Governance] as IField[],
      key,
      GOVERNANCE_FIELD_OVERRIDES,
    ),
  ),
};

export { OnboardingFieldsMap };
