<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Fund Settings Proposal

        <UiTooltipClick
          location="right"
          :hide-after="6000"
        >
          <Icon
            icon="material-symbols:info-outline"
            :class="'main_header__info-icon'"
            width="1.5rem"
            @click="handleInfoClick"
          />

          <template #tooltip>
            <div class="tooltip__content">
              Update Fund Settings on need!
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More 
                <Icon
                  icon="maki:arrow"
                  color="primary"
                  width="1rem"
                />
              </a>
            </div>
          </template>
        </UiTooltipClick>

        <!-- <Icon
          icon="material-symbols:info-outline"
          :class="'main_header__info-icon'"
          width="1.5rem"
          @click="handleInfoClick"
        /> -->

        <!-- <div :class="`info-box-v1 ${isInfoVisible ? 'visible' : ''}`">
          Update Fund Settings on need!
          <a
            class="info-box-v1__link"
            href="https://docs.rethink.finance/rethink.finance"
            target="_blank"
          >Learn More <Icon
            icon="maki:arrow"
            color="primary"
            width="1rem"
          /></a>
        </div> -->
      </div>

      <div class="buttons_container">
        <v-btn
          v-if="showPrevStep"
          variant="outlined"
          color="secondary"
          @click="prevStep"
        >
          Previous
        </v-btn>

        <v-btn
          class="button--primary"
          :type="isLastStep ? 'submit' : 'button'"
          :loading="loading"
          :disabled="isLastStep && !accountStore.isConnected"
          @click="handleButtonClick"
        >
          {{ isLastStep ? "Submit Proposal" : "Next" }}
          <v-tooltip
            v-if="isLastStep && !accountStore.isConnected"
            :model-value="true"
            activator="parent"
            location="top"
            @update:model-value="true"
          >
            Connect your wallet to create a proposal.
          </v-tooltip>
        </v-btn>
      </div>
    </UiHeader>

    <v-form ref="form">
      <div v-for="(step, index) in proposalEntry" :key="index">
        <div
          v-for="(section, index) in step.sections"
          v-if="step.stepName === activeStep"
          :key="index"
          class="section main_card"
        >
          <div class="section__title">
            {{ section.name }}

            <UiTooltipClick
              v-if="section.info"
              :tooltip-text="section.info"
              :hide-after="3000"
            >
              <Icon
                icon="material-symbols:info-outline"
                class="section__info-icon"
                width="1.5rem"
              />
            </UiTooltipClick>

            <div
              v-if="section.name === 'Whitelist'"
              class="toggleable_group__toggle"
            >
              <v-switch
                v-model="isWhitelistToggled"
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
              v-for="(field, index) in section.fields"
              :key="index"
              :cols="field?.cols ?? 12"
            >
              <div v-if="field.isToggleable" class="toggleable_group">
                <div class="toggleable_group__toggle">
                  <v-switch
                    v-model="field.isToggleOn"
                    color="primary"
                    hide-details
                  />
                </div>

                <div class="fields">
                  <v-col
                    v-for="(subField, index) in field.fields"
                    :key="index"
                    :cols="subField?.cols ?? 6"
                  >
                    <UiField
                      v-model="proposal[subField.key]"
                      :field="subField"
                      :is-disabled="!field.isToggleOn"
                      :class="`${isFieldModified(subField.key) && step.stepName !== ProposalStep.Details ? 'modified-field' : ''}`"
                    />
                  </v-col>
                </div>
              </div>
              <div v-else>
                <UiField
                  v-model="proposal[field.key]"
                  :field="field"
                  :class="`${isFieldModified(field.key) && step.stepName !== ProposalStep.Details ? 'modified-field' : ''}`"
                />
              </div>
            </v-col>
          </div>
          <div v-else>
            <SectionWhitelist
              v-if="isWhitelistToggled"
              :items="whitelist"
              @update-items="whitelist = $event"
            />
            <div v-else>
              <UiInfoBox
                class="info-box"
                info="Whitelist is disabled. This means that anyone can deposit into the fund. <br>
                      If you want to enable the whitelist, please toggle the switch above. <br>
                      Whitelist is a list of addresses that are allowed to deposit into the fund."
              />
            </div>
          </div>
        </div>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import GovernableFund from "assets/contracts/GovernableFund.json";
import { useRouter } from "vue-router";
import type { AbiFunctionFragment } from "web3";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import {
  FundSettingProposalFieldsMap,
  ProposalStep,
  ProposalStepMap,
  type IField,
  type IProposal,
  type IStepperSection,
  type IWhitelist,
} from "~/types/enums/fund_setting_proposal";
import type IFund from "~/types/fund";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import SectionWhitelist from "./SectionWhitelist.vue";

const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const router = useRouter();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = toRefs(fundStore);
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
const form = ref(null);
const formIsValid = ref(false);
const isInfoVisible = ref(false);
const isWhitelistToggled = ref(true);

const updateSettingsABI = GovernableFund.abi.find(
  (func) => func.name === "updateSettings" && func.type === "function",
);

// TODO: implement undo changes that will reset form with initial values
let proposalInitial = {} as IProposal;

const proposal = ref<IProposal>({
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
  // Details
  proposalTitle: "",
  proposalDescription: "",
});

const whitelist = ref<IWhitelist[]>([]);

// helper function to generate fields
function generateFields(section: IStepperSection, proposal: IProposal) {
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
  return ProposalStepMap[step]?.sections?.map((section) => ({
    name: section?.name ?? "",
    info: section?.info,
    fields: generateFields(section, proposal),
  })) as { name: string; fields: IField[]; info?: string }[];
}

// main proposalEntry array
const proposalEntry = ref([
  {
    stepName: ProposalStep.Setup,
    stepLabel: ProposalStepMap[ProposalStep.Setup]?.name ?? "",
    sections: generateSections(ProposalStep.Setup, proposal.value),
  },
  {
    stepName: ProposalStep.Details,
    stepLabel: ProposalStepMap[ProposalStep.Details]?.name ?? "",
    sections: generateSections(ProposalStep.Details, proposal.value),
  },
]);

const checkIfAllFieldsValid = () => {
  const output = proposalEntry.value.every((step) => {
    return step.sections.every((section) => {
      return section.fields.every((field) => {
        if (field?.isToggleable) {
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

const handleInfoClick = () => {
  isInfoVisible.value = !isInfoVisible.value;
};

const handleButtonClick = () => {
  isLastStep.value ? submit() : nextStep();
};

const submit = async () => {
  if (!web3Store.web3) return;
  formIsValid.value = checkIfAllFieldsValid();

  if (formIsValid.value) {
    const formattedProposal = formatProposalData(proposal.value);
    console.log("formattedProposal: ", formattedProposal);

    // TODO: we will delete this old proposal after we change how whitelist works in the backend
    const formattedProposalOld = formatProposalDataOld();
    console.log("formattedProposalOld: ", formattedProposalOld);

    const encodedData = web3Store.web3.eth.abi.encodeFunctionCall(
      updateSettingsABI as AbiFunctionFragment,
      formattedProposal,
    );

    const encodedDataOld = web3Store.web3.eth.abi.encodeFunctionCall(
      updateSettingsABI as AbiFunctionFragment,
      formattedProposalOld,
    );

    const targetAddresses = [fund.address, fund.address];
    const gasValues = [0, 0];
    const calldatas = [encodedDataOld, encodedData];

    const proposalDetails = {
      title: proposal.value.proposalTitle,
      description: proposal.value.proposalDescription,
    };

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

    try {
      await fundStore.fundGovernorContract.methods
        .propose(
          targetAddresses,
          gasValues,
          calldatas,
          JSON.stringify({
            title: proposal.value.proposalTitle,
            description: proposal.value.proposalDescription,
          }),
        )
        .send({
          from: fundStore.activeAccountAddress,
          maxPriorityFeePerGas: undefined,
        })
        .on("transactionHash", (hash: string) => {
          console.log("tx hash: " + hash);
          toastStore.addToast(
            "The proposal transaction has been submitted. Please wait for it to be confirmed.",
          );

          router.push(`/details/${selectedFundSlug.value}/governance`);
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

// format proposal data to be sent to the backend
const formatProposalData = (proposal: IProposal) => {
  const originalFundSettings = fund.originalFundSettings;
  console.log("originalFundSettings: ", originalFundSettings);

  // check which fields are toggled off, and set them to 0 or null address
  const toggledOffFields = proposalEntry.value
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

  console.log("toggledOffFields: ", toggledOffFields);
  const nullAddress = "0x0000000000000000000000000000000000000000";

  // 1. if whitelist is toggled on, get the whitelist addresses and filter out the deleted ones
  // 2. if whitelist is toggled off, set the whitelist to an empty array (this will toggle off currently whitelisted addresses in the backend)
  //    because we are sending two calldatas to the backend(the first one is the old proposal and the second one is the new proposal)
  //    old proposal will toggle off currently whitelisted addresses, and the new proposal will be an empty array which means that there will be no whitelisted addresses
  let whitelistValue = [] as string[];
  if (isWhitelistToggled.value === true) {
    whitelistValue = whitelist.value
      .filter((item) => !item.deleted)
      .map((item) => item.address);
  }

  const fundSettings = {
    safe: originalFundSettings?.safe, // did not change
    isExternalGovTokenInUse: originalFundSettings?.isExternalGovTokenInUse, // did not change
    isWhitelistedDeposits: originalFundSettings?.isWhitelistedDeposits, // did not change
    allowedManagers: originalFundSettings?.allowedManagers, // did not change
    fundAddress: originalFundSettings?.fundAddress, // did not change
    governor: originalFundSettings?.governor, // did not change

    depositFee: toggledOffFields.includes("depositFee")
      ? 0
      : parseInt(fromPercentageToBps(proposal.depositFee)),
    withdrawFee: toggledOffFields.includes("redemptionFee")
      ? 0
      : parseInt(fromPercentageToBps(proposal.redemptionFee)),
    performanceFee: toggledOffFields.includes("profitManagemnetFee")
      ? 0
      : parseInt(fromPercentageToBps(proposal.profitManagemnetFee)),
    managementFee: toggledOffFields.includes("managementFee")
      ? 0
      : parseInt(fromPercentageToBps(proposal.managementFee)),
    performaceHurdleRateBps: toggledOffFields.includes("hurdleRate")
      ? 0
      : parseInt(fromPercentageToBps(proposal.hurdleRate)),
    baseToken: proposal.denominationAsset,
    allowedDepositAddrs: whitelistValue,
    governanceToken: proposal.governanceToken,
    fundName: proposal.fundDAOName,
    fundSymbol: proposal.tokenSymbol,
    feeCollectors: [
      toggledOffFields.includes("depositFeeRecipientAddress")
        ? nullAddress
        : proposal.depositFeeRecipientAddress,
      toggledOffFields.includes("redemptionFeeRecipientAddress")
        ? nullAddress
        : proposal.redemptionFeeRecipientAddress,
      toggledOffFields.includes("managementFeeRecipientAddress")
        ? nullAddress
        : proposal.managementFeeRecipientAddress,
      toggledOffFields.includes("profitManagemnetFeeRecipientAddress")
        ? nullAddress
        : proposal.profitManagemnetFeeRecipientAddress,
    ],
  };

  // metadata should be stringified
  const metaData = {
    photoUrl: proposal.photoUrl,
    description: proposal.description,
    plannedSettlementPeriod: proposal.plannedSettlementPeriod,
    minLiquidAssetShare: proposal.minLiquidAssetShare,
  };
  // performance and management periods
  const isPerformancePeriod365 = proposal.profitManagementFeePeriod === "365";
  const isManagementPeriod365 = proposal.managementFeePeriod === "365";
  const isPerformancePeriodToggledOff = toggledOffFields.includes(
    "profitManagementFeePeriod",
  );
  const isManagementPeriodToggledOff = toggledOffFields.includes(
    "managementFeePeriod",
  );

  const performancePeriod =
    isPerformancePeriodToggledOff || isPerformancePeriod365
      ? 0
      : parseInt(proposal.profitManagementFeePeriod);
  const managementPeriod =
    isManagementPeriodToggledOff || isManagementPeriod365
      ? 0
      : parseInt(proposal.managementFeePeriod);

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

  activeStep.value = proposalSteps[proposalSteps.indexOf(activeStep.value) + 1];
};

// if fee period is 0 set it to 365
const parsedFeePeriod = (value: string) => {
  return value === "0" ? "365" : value;
};

const populateProposal = () => {
  const fundDeepCopy = JSON.parse(
    JSON.stringify(fund, stringifyBigInt),
    parseBigInt,
  );

  console.log("fundDeepCopy: ", fundDeepCopy);

  proposal.value = {
    // Metadata
    photoUrl: fundDeepCopy?.photoUrl ?? "",
    plannedSettlementPeriod: fundDeepCopy?.plannedSettlementPeriod ?? "",
    minLiquidAssetShare: fundDeepCopy?.minLiquidAssetShare ?? "",
    description: fundDeepCopy?.description ?? "",
    // Fund settings
    fundDAOName: fundDeepCopy?.title ?? "",
    tokenSymbol: fundDeepCopy?.fundToken?.symbol ?? "",
    denominationAsset: fundDeepCopy?.baseToken?.address ?? "",
    depositFee: fromBpsToPercentage(fundDeepCopy?.depositFee),
    depositFeeRecipientAddress: fundDeepCopy?.depositFeeAddress ?? "",
    redemptionFee: fromBpsToPercentage(fundDeepCopy?.withdrawFee),
    redemptionFeeRecipientAddress: fundDeepCopy?.withdrawFeeAddress ?? "",
    managementFee: fromBpsToPercentage(fundDeepCopy?.managementFee),
    managementFeeRecipientAddress: fundDeepCopy?.managementFeeAddress ?? "",
    managementFeePeriod: parsedFeePeriod(fundDeepCopy?.managementPeriod ?? ""),
    profitManagemnetFee: fromBpsToPercentage(fundDeepCopy?.performanceFee),
    profitManagemnetFeeRecipientAddress:
      fundDeepCopy?.performanceFeeAddress ?? "",
    profitManagementFeePeriod: parsedFeePeriod(
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
  };

  whitelist.value = fundDeepCopy?.allowedDepositAddresses?.map(
    (item: string) => ({
      deleted: false,
      isNew: false,
      address: item,
    }),
  ) as IWhitelist[];

  // Store the original values for comparison
  proposalInitial = JSON.parse(
    JSON.stringify(proposal.value, stringifyBigInt),
    parseBigInt,
  );
};

const isFieldModified = (key: keyof IProposal) => {
  const output = proposal.value[key] !== proposalInitial[key];

  return output;
};

watch(
  proposal,
  (newValue, oldValue) => {
    proposalEntry.value.forEach((step) => {
      step.sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field?.isToggleable) {
            field?.fields?.forEach((subField) => {
              subField.value = newValue[subField?.key];
            });
          } else {
            field.value = newValue[field?.key];
          }
        });
      });
    });
  },
  { deep: true },
);

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
  populateProposal(); // Populate proposal with fund data
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">
.main_header {
  flex-wrap: wrap;
  gap: 15px;

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    gap: 10px;

    font-size: 16px;
    font-weight: bold;
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
    color: $color-text-irrelevant;
  }
}
.buttons_container {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  margin-left: auto;
}
.toggleable_group {
  &__toggle {
    display: flex;
    justify-content: flex-end;
    margin-left: auto;
  }
}

.section {
  &__title {
    display: flex;
    gap: 15px;
    align-items: center;
    padding: 12px;
    margin-bottom: 15px;

    font-size: 16px;
    font-weight: 700;
    color: $color-white;
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

.modified-field {
  :deep(.v-field__input) {
    color: var(--color-success);
  }
}

.info-box-v1 {
  display: flex;
  gap: 40px;

  padding: 12px;
  border-radius: 4px;
  background-color: #111c35;
  box-shadow: 0px 0px 16px 0px $color-box-shadow;

  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: $color-text-irrelevant;

  opacity: 0;
  transition: opacity 0.3s ease-in-out;

  &.visible {
    opacity: 1;
  }

  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}

.section-whitelist {
  display: none;
  &.toggle__on {
    display: block;
  }
}
.tooltip{
  &__content{
    display: flex;
    gap: 40px;
  }
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}
</style>
