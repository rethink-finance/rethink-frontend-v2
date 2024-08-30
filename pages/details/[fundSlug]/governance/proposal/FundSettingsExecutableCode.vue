<template>
  <div
    class="fund_settings_executable_code section"
    v-for="(section, index) in sections"
    :key="index"
  >
    <div class="section__title">
      {{ section.name }}
    </div>

    <div class="fields">
      <v-col
        v-for="(field, index) in section.fields"
        :key="index"
        :cols="field?.cols ?? 12"
      >
        <div class="toggleable_group" v-if="field.isToggleable">
          <div class="fields">
            <v-col
              :cols="subField?.cols ?? 6"
              v-for="(subField, index) in field.fields"
              :key="index"
            >
              <UiField
                :field="subField"
                v-model="subField.value"
                :is-preview="true"
              />
            </v-col>
          </div>
        </div>
        <UiField
          v-else
          :field="field"
          :is-preview="true"
          v-model="field.value"
        />
      </v-col>
    </div>
  </div>
</template>

<script setup lang="ts">
// fund store
import {
  FundSettingProposalFieldsMap,
  ProposalStep,
  ProposalStepMap,
  type IField,
  type IProposal,
  type IStepperSection,
} from "~/types/enums/fund_setting_proposal";
import type IFund from "~/types/fund";
import type IGovernanceProposal from "~/types/governance_proposal";

const props = defineProps<{
  proposal: IGovernanceProposal;
  fund: IFund;
}>();

const proposalFundSettings = ref<Partial<IProposal>>({
  // Basics
  photoUrl: "",
  fundDAOName: "",
  tokenSymbol: "",
  denominationAsset: "",
  description: "",
  // Fees
  depositFee: "",
  depositFeeRecipientAddress: "",
  redemptionFee: "",
  redemptionFeeRecipientAddress: "",
  managementFee: "",
  managementFeeRecipientAddress: "",
  managementFeePeriod: "",
  profitManagemnetFee: "",
  profitManagemnetFeeRecipientAddress: "",
  profitManagementFeePeriod: "",
  hurdleRate: "",
  // Whitelist
  whitelist: "",
  // Management
  plannedSettlementPeriod: "",
  minLiquidAssetShare: "",
  // Governance
  governanceToken: "",
  quorum: "",
  votingPeriod: "",
  votingDelay: "",
  proposalThreshold: "",
  lateQuorum: "",
});

// helper function to generate fields
function generateFields(section: IStepperSection, proposal: Partial<IProposal>) {
  return FundSettingProposalFieldsMap[section.key]?.map((field) => {
    if (field?.isToggleable) {
      const output = field?.fields?.map((subField) => ({
        ...subField,
        value: proposal[subField?.key] as string,
      }));

      return {
        ...field,
        fields: output,
      };
    } else {
      const fieldTyped = field as IField;
      return {
        ...fieldTyped,
        value: proposal[fieldTyped.key] as string,
      } as IField;
    }
  });
}

// helper function to generate sections
function generateSections(proposal: Partial<IProposal>) {
  return ProposalStepMap[ProposalStep.Setup]?.sections?.map((section) => ({
    name: section?.name ?? "",
    info: section?.info,
    fields: generateFields(section, proposal),
  })) as { name: string; fields: IField[]; info?: string }[];
}

const sections = computed(() => generateSections(proposalFundSettings.value));

const populateProposalData = () => {
  if (!props.proposal) return;
  const fundDeepCopy = props.fund ? JSON.parse(
    JSON.stringify(props.fund, stringifyBigInt),
    parseBigInt
  ) : null;

  // TODO: index will change after we change the way whitelists toggles in the backend
  const calldata = props.proposal?.calldatasDecoded[1] ?? {};
  if (Object.keys(calldata).length === 0) return;

  const settings = {
    ...calldata.calldataDecoded._fundSettings,
  };
  const metaData = JSON.parse(calldata.calldataDecoded._fundMetadata);
  const managementFeePeriod = calldata.calldataDecoded._feeManagePeriod;
  const profitManagementFeePeriod =
    calldata.calldataDecoded._feePerformancePeriod;

  proposalFundSettings.value = {
    photoUrl: metaData.photoUrl,
    fundDAOName: settings.fundName,
    tokenSymbol: settings.fundSymbol,
    denominationAsset: settings.baseToken,
    description: metaData.description,
    // Fees
    depositFee: settings.depositFee,
    depositFeeRecipientAddress: settings.feeCollectors[0],
    redemptionFee: settings.withdrawFee,
    redemptionFeeRecipientAddress: settings.feeCollectors[1],
    managementFee: settings.managementFee,
    managementFeeRecipientAddress: settings.feeCollectors[2],
    managementFeePeriod: managementFeePeriod,
    profitManagemnetFee: settings.performanceFee,
    profitManagemnetFeeRecipientAddress: settings.feeCollectors[3],
    profitManagementFeePeriod: profitManagementFeePeriod,
    hurdleRate: settings.performaceHurdleRateBps,
    // Whitelist
    whitelist: settings.allowedDepositAddrs.join("\n"),
    // Management
    plannedSettlementPeriod: metaData.plannedSettlementPeriod,
    minLiquidAssetShare: metaData.minLiquidAssetShare,
    // Governance
    governanceToken: fundDeepCopy?.governanceToken?.address ?? "",
    quorum: fundDeepCopy?.quorumPercentage ?? "",
    votingPeriod: fundDeepCopy?.votingPeriod ?? "",
    votingDelay: fundDeepCopy?.votingDelay ?? "",
    proposalThreshold: fundDeepCopy?.proposalThreshold ?? "",
    lateQuorum: fundDeepCopy?.lateQuorum ?? "",
  };

  return calldata;
};

// populate proposal data on load
watch(
  () => props.proposal,
  (newValue) => {
    populateProposalData();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.section {
  &__title {
    display: flex;
    gap: 15px;
    align-items: center;

    font-size: 16px;
    font-weight: 700;
    color: $color-white;
  }
}
.fields {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}
</style>
