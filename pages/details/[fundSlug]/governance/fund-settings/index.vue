<template>
  <div>
    <FundSettingsProposalHeader
      :show-prev-step="showPrevStep"
      :is-last-step="isLastStep"
      :loading="loading"
      @prev-step="prevStep"
      @handle-click="handleButtonClick"
    />

    <v-form ref="form">
      <div v-for="(step, indexStep) in proposalEntry" :key="indexStep">
        <template v-for="(section, indexSection) in step.sections">
          <div
            v-if="step.stepName === activeStep"
            :key="indexSection"
            class="section main_card"
          >
            <div class="section__title subtitle_white">
              {{ section.name }}

              <UiTooltipClick v-if="section.info" :hide-after="8000">
                <Icon
                  icon="material-symbols:info-outline"
                  class="section__info-icon"
                  width="1.5rem"
                />

                <template #tooltip>
                  {{ section.info }}
                </template>
              </UiTooltipClick>

              <div
                v-if="section.name === 'Whitelist'"
              >
                <v-switch
                  v-model="isWhitelistedDeposits"
                  color="primary"
                  hide-details
                />
              </div>
            </div>

            <UiInfoBox
              v-if="section.info"
              class="info-box"
              :info="section.info"
            />

            <div v-if="section.name !== 'Whitelist'" class="fields">
              <v-col
                v-for="(field, indexField) in section.fields"
                :key="indexField"
                :cols="field?.cols ?? 12"
              >
                <UiFieldsGroup
                  v-if="field.fields"
                  v-model:is-toggle-on="field.isToggleOn"
                  :field-group="field"
                >
                  <template #default="{ subField }">
                    <UiField
                      v-model="subField.value"
                      :field="subField"
                      :is-disabled="!field.isToggleOn"
                      :initial-value="step.stepName !== ProposalStep.Details ? proposalInitial[subField.key] : undefined"
                      :chain-id="fund.chainId"
                    />
                  </template>

                </UiFieldsGroup>
                <div v-else>
                  <UiField
                    v-model="field.value"
                    :field="field"
                    :initial-value="step.stepName !== ProposalStep.Details ? proposalInitial[field.key] : undefined"
                    :chain-id="fund.chainId"
                  />
                </div>
              </v-col>
            </div>
            <div v-else>
              <FundSettingsSectionWhitelist
                v-model="whitelistAddresses"
                v-model:whitelist-enabled="isWhitelistedDeposits"
              />
            </div>
          </div>
        </template>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useRouter } from "vue-router";
import type { AbiFunctionFragment } from "web3";
import { encodeFunctionCall } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type { IField } from "~/types/enums/input_type";

import {
  FundSettingsStepFieldsMap,
  FundSettingsStepsMap,
  ProposalStep,
  type IProposal,
  type IStepperSection,
  type IWhitelist,
} from "~/types/enums/fund_setting_proposal";
import type IFund from "~/types/fund";
import type BreadcrumbItem from "~/types/ui/breadcrumb";

const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(fundStore);
const proposalSteps = Object.values(ProposalStep);

const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Fund Setting Proposal",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance/fund-settings`,
  },
];

const loading = ref(false);
const activeStep = ref(proposalSteps[0]);
const form = ref();
const formIsValid = ref(false);

const updateSettingsABI = GovernableFund.abi.find(
  (func: any) => func.name === "updateSettings" && func.type === "function",
);

// TODO: implement undo changes that will reset form with initial values
// we need to have proposalInitial so that we can compare the initial values with the current values
const proposalInitial = ref({} as IProposal);

const whitelistAddresses = ref<IWhitelist[]>([]);
const isWhitelistedDeposits = ref(false);


// if fee period is 0 set it to 365
const parsedFeePeriod = (value: string) => {
  return value === "0" ? "365" : value;
};

// helper function to generate fields
function generateFields(section: IStepperSection, proposal: IProposal) {
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
function generateSections(step: ProposalStep, proposal: IProposal) {
  return FundSettingsStepsMap[step]?.sections?.map((section) => ({
    name: section?.name ?? "",
    info: section?.info,
    fields: generateFields(section, proposal),
  })) as { name: string; fields: IField[]; info?: string }[];
}


const generateSteps = (proposalEntry: IProposal) => {
  return proposalSteps.map((step) => ({
    stepName: step,
    stepLabel: FundSettingsStepsMap[step]?.name ?? "",
    sections: generateSections(step, proposalEntry),
  }));
};

const initProposalEntry = () => {
  const fundDeepCopy = JSON.parse(
    JSON.stringify(fund, stringifyBigInt),
    parseBigInt,
  );

  console.log("fundDeepCopy: ", fundDeepCopy);

  const proposal = {
    // Metadata
    photoUrl: fundDeepCopy?.photoUrl ?? "",
    plannedSettlementPeriod: fundDeepCopy?.plannedSettlementPeriod ?? "",
    minLiquidAssetShare: fundDeepCopy?.minLiquidAssetShare ?? "",
    description: fundDeepCopy?.description ?? "",
    // Fund settings
    fundName: fundDeepCopy?.title ?? "",
    fundSymbol: fundDeepCopy?.fundToken?.symbol ?? "",
    baseToken: fundDeepCopy?.baseToken?.address ?? "",
    depositFee: fromBpsToPercentage(fundDeepCopy?.depositFee),
    depositFeeRecipientAddress: fundDeepCopy?.depositFeeAddress ?? "",
    withdrawFee: fromBpsToPercentage(fundDeepCopy?.withdrawFee),
    withdrawFeeRecipientAddress: fundDeepCopy?.withdrawFeeAddress ?? "",
    managementFee: fromBpsToPercentage(fundDeepCopy?.managementFee),
    managementFeeRecipientAddress: fundDeepCopy?.managementFeeAddress ?? "",
    managementFeePeriod: parsedFeePeriod(fundDeepCopy?.managementPeriod ?? ""),
    performanceFee: fromBpsToPercentage(fundDeepCopy?.performanceFee),
    performanceFeeRecipientAddress:
      fundDeepCopy?.performanceFeeAddress ?? "",
    performanceFeePeriod: parsedFeePeriod(
      fundDeepCopy?.performancePeriod ?? "",
    ),
    hurdleRate: fromBpsToPercentage(fundDeepCopy?.performaceHurdleRateBps),
    // Governance
    governanceToken: fundDeepCopy?.governanceToken?.address ?? "",
    quorum: fundDeepCopy?.quorumPercentage ?? "",
    votingPeriod: fundDeepCopy?.votingPeriod ?? "",
    votingDelay: fundDeepCopy?.votingDelay ?? "",
    proposalThreshold: fundDeepCopy?.proposalThreshold ?? "",
    lateQuorum: fundDeepCopy?.lateQuorum ?? "",
    // Details
    proposalTitle: "",
    proposalDescription: "",
    // Whitelist
    whitelist: "",
    isWhitelistedDeposits: fundDeepCopy?.isWhitelistedDeposits,
  };

  whitelistAddresses.value = fundDeepCopy?.allowedDepositAddresses?.map(
    (item: string) => ({
      deleted: false,
      isNew: false,
      address: item,
    }),
  ) as IWhitelist[];

  isWhitelistedDeposits.value = fundDeepCopy?.isWhitelistedDeposits || false;

  // Store the original values for comparison
  proposalInitial.value = JSON.parse(
    JSON.stringify(proposal, stringifyBigInt),
    parseBigInt,
  );

  return generateSteps(proposalInitial.value);
};

// main proposalEntry array
const proposalEntry = ref(initProposalEntry());

const getStepValidityArray = () => {
  const output = proposalEntry.value.map((step) => {
    return step.sections.every((section) => {
      return section.fields.every((field) => {
        if (field?.isToggleable) {
          // disabled fields should be considered valid
          if(!field.isToggleOn) {
            return true;
          }
          return field?.fields?.every((subField) => {
            return (
              subField?.rules?.every((rule) => {
                return rule(subField.value) === true;
              }) ?? true
            );
          });
        }
        return (
          field?.rules?.every((rule) => {
            return rule(field.value) === true;
          }) ?? true
        );
      });
    });
  });

  return output;
};

const showPrevStep = computed(() => {
  return activeStep.value !== proposalSteps[0];
});

const isLastStep = computed(() => {
  return activeStep.value === proposalSteps[proposalSteps.length - 1];
});

const handleButtonClick = () => {
  isLastStep.value ? submit() : nextStep();
};

const submit = async () => {
  // trigger form validation to show errors
  const valid = form.value?.validate();
  // check if every step is valid
  formIsValid.value = getStepValidityArray().every((step) => step);

  if (formIsValid.value) {
    try {
      loading.value = true;
      const formattedProposal = formatProposalData();
      console.log("formattedProposal: ", formattedProposal);

      // TODO: we will delete this old proposal after we change how whitelist works in the backend
      const formattedProposalOld = formatProposalDataOld();
      console.log("formattedProposalOld: ", formattedProposalOld);

      const encodedData = encodeFunctionCall(
        updateSettingsABI as AbiFunctionFragment,
        formattedProposal,
      );

      const encodedDataOld = encodeFunctionCall(
        updateSettingsABI as AbiFunctionFragment,
        formattedProposalOld,
      );

      const targetAddresses = [fund.address, fund.address];
      const gasValues = [0, 0];
      const calldatas = [encodedDataOld, encodedData];

      console.log(
        "proposal:",
        JSON.stringify(
          {
            targetAddresses,
            gasValues,
            calldatas,
          },
          null,
          2,
        ),
      );

      const proposalData = [
        targetAddresses,
        gasValues,
        calldatas,
        JSON.stringify({
          title: getFieldValueByFieldKey("proposalTitle"),
          description: getFieldValueByFieldKey("proposalDescription"),
        }),
      ];

      await fundStore.fundGovernorContract
        .send("propose", {}, ...proposalData)
        .on("transactionHash", (hash: any) => {
          console.log("tx hash: " + hash);
          toastStore.addToast(
            "The proposal transaction has been submitted. Please wait for it to be confirmed.",
          );
        })
        .on("receipt", (receipt: any) => {
          console.log("receipt: ", receipt);
          if (receipt.status) {
            toastStore.successToast(
              "Register the proposal transactions was successful. " +
                "You can now vote on the proposal in the governance page.",
            );
            router.push(`/details/${selectedFundSlug.value}/governance`);
          } else {
            toastStore.errorToast(
              "The register proposal transaction has failed. Please contact the Rethink Finance support.",
            );
          }
          loading.value = false;
        })
        .on("error", (error: any) => {
          console.error(error);
          loading.value = false;
          toastStore.errorToast(
            "There has been an error. Please contact the Rethink Finance support.",
          );
        });
    } catch (error: any) {
      loading.value = false;
      toastStore.errorToast(error.message);
    }
  } else {
    toastStore.warningToast("Please fill all the required fields");
  }
};


// check which fields are toggled off, and set them to 0 or null address
const toggledOffFields = computed(() =>{
  return proposalEntry.value
    .map((step) => {
      return step.sections.map((section) => {
        return section.fields
          .filter((field) => field.isToggleOn === false)
          .map((field) => {
            if (field.fields) {
              return field.fields
                .filter((subField) => !subField.isToggleOn)
                .map((subField) => subField.key);
            }
            return field.key;
          });
      });
    })
    .flat(2)
    .flat();
});

const getFieldValueByFieldKey = (fieldKey: string) => {
  for (const step of proposalEntry.value) {
    for (const section of step.sections) {
      for (const field of section.fields) {
        if (field.key === fieldKey) {
          return field.value;
        }
        if (field.fields) {
          for (const subField of field.fields) {
            if (subField.key === fieldKey) {
              return subField.value;
            }
          }
        }
      }
    }
  }
};

// format proposal data to be sent to the backend
const formatProposalData = () => {
  const originalFundSettings = fund.originalFundSettings;

  // 1. if whitelist is toggled on, get the whitelist addresses and filter out the deleted ones
  // 2. if whitelist is toggled off, set the whitelist to an empty array (this will toggle off currently whitelisted addresses in the backend)
  //    because we are sending two calldatas to the backend(the first one is the old proposal and the second one is the new proposal)
  //    old proposal will toggle off currently whitelisted addresses, and the new proposal will be an empty array which means that there will be no whitelisted addresses
  let allowedDepositors = [] as string[];
  if (isWhitelistedDeposits.value) {
    allowedDepositors = whitelistAddresses.value
      .filter((item) => !item.deleted)
      .map((item) => item.address);
  }

  let isWhitelistedDepositsSubmit = isWhitelistedDeposits.value;
  // Disable the isWhitelistedDeposits if there are no addresses so that everyone can deposit.
  if (!allowedDepositors?.length) {
    isWhitelistedDepositsSubmit = false;
  }

  const fundSettings = {
    safe: originalFundSettings?.safe, // did not change
    isExternalGovTokenInUse: originalFundSettings?.isExternalGovTokenInUse, // did not change
    allowedManagers: originalFundSettings?.allowedManagers, // did not change
    fundAddress: originalFundSettings?.fundAddress, // did not change
    governor: originalFundSettings?.governor, // did not change
    isWhitelistedDepositsSubmit,
    depositFee: toggledOffFields.value.includes("depositFee")
      ? 0
      : parseInt(fromPercentageToBps(getFieldValueByFieldKey("depositFee"))),
    withdrawFee: toggledOffFields.value.includes("withdrawFee")
      ? 0
      : parseInt(fromPercentageToBps(getFieldValueByFieldKey("withdrawFee"))),
    performanceFee: toggledOffFields.value.includes("performanceFee")
      ? 0
      : parseInt(fromPercentageToBps(getFieldValueByFieldKey("performanceFee"))),
    managementFee: toggledOffFields.value.includes("managementFee")
      ? 0
      : parseInt(fromPercentageToBps(getFieldValueByFieldKey("managementFee"))),
    performaceHurdleRateBps: 0, // note from Rok to always submit 0 here
    baseToken: getFieldValueByFieldKey("baseToken"),
    allowedDepositAddrs: allowedDepositors,
    governanceToken: getFieldValueByFieldKey("governanceToken"),
    fundName: getFieldValueByFieldKey("fundName"),
    fundSymbol: getFieldValueByFieldKey("fundSymbol"),
    feeCollectors: [
      toggledOffFields.value.includes("depositFeeRecipientAddress")
        ? ethers.ZeroAddress
        : getFieldValueByFieldKey("depositFeeRecipientAddress"),
      toggledOffFields.value.includes("withdrawFeeRecipientAddress")
        ? ethers.ZeroAddress
        : getFieldValueByFieldKey("withdrawFeeRecipientAddress"),
      toggledOffFields.value.includes("managementFeeRecipientAddress")
        ? ethers.ZeroAddress
        : getFieldValueByFieldKey("managementFeeRecipientAddress"),
      toggledOffFields.value.includes("performanceFeeRecipientAddress")
        ? ethers.ZeroAddress
        : getFieldValueByFieldKey("performanceFeeRecipientAddress"),
    ],
  };

  // metadata should be stringified
  const metaData = {
    photoUrl: getFieldValueByFieldKey("photoUrl"),
    description: getFieldValueByFieldKey("description"),
    plannedSettlementPeriod: getFieldValueByFieldKey("plannedSettlementPeriod"),
    minLiquidAssetShare: getFieldValueByFieldKey("minLiquidAssetShare"),
  };
  // performance and management periods
  const isPerformancePeriod365 = getFieldValueByFieldKey("performanceFeePeriod") === "365";
  const isManagementPeriod365 = getFieldValueByFieldKey("managementFeePeriod") === "365";
  const isPerformancePeriodToggledOff = toggledOffFields.value.includes(
    "performanceFeePeriod",
  );
  const isManagementPeriodToggledOff = toggledOffFields.value.includes(
    "managementFeePeriod",
  );

  const performancePeriod =
    isPerformancePeriodToggledOff || isPerformancePeriod365
      ? 0
      : parseInt(getFieldValueByFieldKey("performanceFeePeriod") as string);
  const managementPeriod =
    isManagementPeriodToggledOff || isManagementPeriod365
      ? 0
      : parseInt(getFieldValueByFieldKey("managementFeePeriod") as string);

  return [
    fundSettings,
    JSON.stringify(metaData),
    managementPeriod,
    performancePeriod,
  ];
};

// TODO: we will delete this old proposal after we change how whitelist works in the backend
const formatProposalDataOld = () => {
  const fundSettings = {
    ...fund.originalFundSettings,
  };
  const metaData = {
    photoUrl: fund.photoUrl,
    description: fund.description,
    plannedSettlementPeriod: fund.plannedSettlementPeriod,
    minLiquidAssetShare: fund.minLiquidAssetShare,
  };
  const performancePeriod = fund.performancePeriod;
  const managementPeriod = fund.managementPeriod;

  return [
    fundSettings,
    JSON.stringify(metaData),
    managementPeriod,
    performancePeriod,
  ];
};

const prevStep = () => {
  activeStep.value = proposalSteps[proposalSteps.indexOf(activeStep.value) - 1];
};

const nextStep = () => {
  if (activeStep.value === proposalSteps[proposalSteps.length - 1]) {
    return;
  }
  // trigger form validation to show errors
  const valid = form.value?.validate();
  // check if step is valid before moving to the next step
  const stepIndex = proposalSteps.indexOf(activeStep.value);
  const stepValidityArray = getStepValidityArray();
  if (!stepValidityArray[stepIndex]) {
    toastStore.warningToast("Please fill all the required fields");
    return;
  }

  activeStep.value = proposalSteps[proposalSteps.indexOf(activeStep.value) + 1];
};


onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">

.section {
  &__title {
    display: flex;
    gap: 15px;
    align-items: center;
    padding: 12px;
    margin-bottom: 15px;
  }
  &__info-icon {
    cursor: pointer;
    color: $color-disabled;
  }
}

.info-box {
  margin: 12px 12px 40px;
}

.fields {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}

.section-whitelist {
  display: none;
  &.toggle__on {
    display: block;
  }
}
</style>
