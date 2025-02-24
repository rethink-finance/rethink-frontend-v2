<template>
  <div
    v-for="(section, index) in sections"
    :key="index"
    class="fund_settings_executable_code section"
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
        <div v-if="field.isToggleable" class="toggleable_group">
          <div class="fields">
            <v-col
              v-for="(subField, subFieldIndex) in field.fields"
              :key="subFieldIndex"
              :cols="subField?.cols ?? 6"
            >
              <UiField
                v-model="subField.value"
                :field="subField"
                :is-preview="true"
              />
            </v-col>
          </div>
        </div>
        <UiField
          v-else
          v-model="field.value"
          :field="field"
          :is-preview="true"
        />
      </v-col>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import type { IField } from "~/types/enums/input_type";

import {
  FundSettingsStepFieldsMap,
  ProposalStep,
  FundSettingsStepsMap,
  type IProposal,
  type IStepperSection,
} from "~/types/enums/fund_setting_proposal";
const fundStore = useFundStore();

const props = defineProps<{
  calldataDecoded: any;
}>();

const proposalFundSettings = ref<Partial<IProposal>>({
  // Basics
  photoUrl: "",
  fundName: "",
  fundSymbol: "",
  baseToken: "",
  description: "",
  // Fees
  depositFee: "",
  depositFeeRecipientAddress: "",
  withdrawFee: "",
  withdrawFeeRecipientAddress: "",
  managementFee: "",
  managementFeeRecipientAddress: "",
  managementFeePeriod: "",
  performanceFee: "",
  performanceFeeRecipientAddress: "",
  performanceFeePeriod: "",
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
function generateFields(
  section: IStepperSection,
  proposal: Partial<IProposal>,
) {
  return FundSettingsStepFieldsMap[section.key]?.map((field) => {
    if (field?.isToggleable) {
      const output = field?.fields?.map((subField) => ({
        ...subField,
        value: proposal[subField?.key] as string,
      }));

      return {
        ...field,
        fields: output,
      };
    }
    const fieldTyped = field as IField;
    return {
      ...fieldTyped,
      value: proposal[fieldTyped.key] as string,
    } as IField;
  });
}

// helper function to generate sections
function generateSections(proposal: Partial<IProposal>) {
  return FundSettingsStepsMap[ProposalStep.Setup]?.sections?.map((section) => ({
    name: section?.name ?? "",
    info: section?.info,
    fields: generateFields(section, proposal),
  })) as { name: string; fields: IField[]; info?: string }[];
}

const sections = computed(() => generateSections(proposalFundSettings.value));

const populateProposalData = () => {
  // if no decoded data, return
  if (Object.keys(props.calldataDecoded).length === 0) return;

  const fundDeepCopy = fundStore.fund
    ? JSON.parse(JSON.stringify(fundStore.fund, stringifyBigInt), parseBigInt)
    : null;

  const settings = {
    ...props.calldataDecoded._fundSettings,
  };
  const metaData = JSON.parse(props.calldataDecoded._fundMetadata);
  const managementFeePeriod = props.calldataDecoded._feeManagePeriod;
  const performanceFeePeriod = props.calldataDecoded._feePerformancePeriod;

  proposalFundSettings.value = {
    photoUrl: metaData.photoUrl,
    fundName: settings.fundName,
    fundSymbol: settings.fundSymbol,
    baseToken: settings.baseToken,
    description: metaData.description,
    // Fees
    depositFee: fromBpsToPercentage(settings.depositFee),
    depositFeeRecipientAddress: settings.feeCollectors[0],
    withdrawFee: fromBpsToPercentage(settings.withdrawFee),
    withdrawFeeRecipientAddress: settings.feeCollectors[1],
    managementFee: fromBpsToPercentage(settings.managementFee),
    managementFeeRecipientAddress: settings.feeCollectors[2],
    managementFeePeriod,
    performanceFee: fromBpsToPercentage(settings.performanceFee),
    performanceFeeRecipientAddress: settings.feeCollectors[3],
    performanceFeePeriod,
    hurdleRate: fromBpsToPercentage(settings.performaceHurdleRateBps),
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
};

// populate proposal data on load
watch(
  () => props.calldataDecoded,
  (newValue) => {
    populateProposalData();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.section {
  &__title {
    display: flex;
    gap: 15px;
    align-items: center;
    font-size: $text-md;
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
