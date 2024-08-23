<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Fund Settings Proposal

        <Icon
          icon="material-symbols:info-outline"
          :class="'main_header__info-icon'"
          width="1.5rem"
          @click="handleInfoClick"
        />

        <div :class="`info-box-v1 ${isInfoVisible ? 'visible' : ''}`">
          Update Fund Settings on need!
          <a
            class="info-box-v1__link"
            href="https://docs.rethink.finance/rethink.finance"
            target="_blank"
            >Learn More <Icon icon="maki:arrow" color="primary" width="1rem"
          /></a>
        </div>
      </div>

      <div class="buttons_container">
        <v-btn
          v-if="showPrevStep"
          @click="prevStep"
          variant="outlined"
          color="secondary"
        >
          Previous
        </v-btn>

        <v-btn
          class="button--primary"
          :type="isLastStep ? 'submit' : 'button'"
          :loading="isSubmitLoading"
          @click="handleButtonClick"
          :disabled="isLastStep && !accountStore.isConnected"
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
          v-if="step.stepName === activeStep"
          v-for="(section, index) in step.sections"
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
          </div>

          <UiInfoBox
            class="info-box"
            v-if="section.info"
            :info="section.info"
          />

          <div class="fields" v-if="section.name !== 'Whitelist'">
            <v-col
              v-for="(field, index) in section.fields"
              :key="index"
              :cols="field?.cols ?? 12"
            >
              <div class="toggleable_group" v-if="field.isToggleable">
                <div class="toggleable_group__toggle">
                  <v-switch
                    v-model="field.isToggleOn"
                    color="primary"
                    hide-details
                  />
                </div>

                <div class="fields">
                  <v-col
                    :cols="subField?.cols ?? 6"
                    v-for="(subField, index) in field.fields"
                    :key="index"
                  >
                    <UiField
                      :field="subField"
                      v-model="proposal[subField.key]"
                      :is-disabled="!field.isToggleOn"
                      :class="`${isFieldModified(subField.key) ? 'modified-field' : ''}`"
                    />
                  </v-col>
                </div>
              </div>
              <div v-else>
                <UiField
                  :field="field"
                  v-model="proposal[field.key]"
                  :class="`${isFieldModified(field.key) ? 'modified-field' : ''}`"
                />
              </div>
            </v-col>
          </div>
          <div v-else class="section-whitelist">
            <SectionWhitelist :items="whitelist" />
          </div>
        </div>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
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
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance/fund-settings`,
  },
];

const isSubmitLoading = ref(false);
const activeStep = ref(proposalSteps[0]);
const form = ref(null);
const formIsValid = ref(false);
const isInfoVisible = ref(false);

// TODO: implement undo changes that will reset form with initial values
let proposalInitial = {} as IProposal;

// TODO: rename keys to match the proposal keys from the API
const proposal = ref<IProposal>({
  // Basics
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

const whitelist = ref<IWhitelist[]>([
  {
    deleted: false,
    isNew: true,
    address: "0x1234567890123456789012345678901234567890",
  },
  {
    deleted: true,
    isNew: false,
    address: "0x1234567890123456789012345678901234567880",
  },
  {
    deleted: true,
    isNew: true,
    address: "0x1234567890123456789012345678901234567870",
  },
  {
    deleted: false,
    isNew: false,
    address: "0x1234567890123456789012345678901234567860",
  },
]);

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
        } else {
          return (
            field?.rules?.every((rule) => {
              return rule(field.value) === true;
            }) ?? true
          );
        }
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

const submit = () => {
  console.log("proposal.value: ", proposal.value);

  formIsValid.value = checkIfAllFieldsValid();

  if (formIsValid.value) {
    toastStore.successToast("Proposal submitted successfully");

    // TODO: here goes the logic to submit the proposal

    // router.push(`/details/${selectedFundSlug.value}/governance`);
  } else {
    // form.value?.validate();
    toastStore.warningToast("Please fill all the required fields");
  }
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
    parseBigInt
  );

  console.log("fundDeepCopy: ", fundDeepCopy);

  proposal.value = {
    fundDAOName: fundDeepCopy?.title ?? "",
    tokenSymbol: fundDeepCopy?.fundToken?.symbol ?? "",
    denominationAsset: fundDeepCopy?.baseToken?.address ?? "",
    description: fundDeepCopy?.description ?? "",
    depositFee: fundDeepCopy?.depositFee ?? "",
    depositFeeRecipientAddress: fundDeepCopy?.depositFeeAddress ?? "",
    redemptionFee: fundDeepCopy?.withdrawFee ?? "",
    redemptionFeeRecipientAddress: fundDeepCopy?.withdrawFeeAddress ?? "",
    managementFee: fundDeepCopy?.managementFee ?? "",
    managementFeeRecipientAddress: fundDeepCopy?.managementFeeAddress ?? "",
    managementFeePeriod: parsedFeePeriod(fundDeepCopy?.managementPeriod ?? ""),
    profitManagemnetFee: fundDeepCopy?.performanceFee ?? "",
    profitManagemnetFeeRecipientAddress:
      fundDeepCopy?.performanceFeeAddress ?? "",
    profitManagementFeePeriod: parsedFeePeriod(
      fundDeepCopy?.performancePeriod ?? ""
    ),
    hurdleRate: fundDeepCopy?.performaceHurdleRateBps ?? "",
    plannedSettlementPeriod: fundDeepCopy?.plannedSettlementPeriod ?? "",
    minLiquidAssetShare: fundDeepCopy?.minLiquidAssetShare ?? "",
    governanceToken: fundDeepCopy?.governanceToken?.symbol ?? "",
    quorum: fundDeepCopy?.quorumPercentage ?? "",
    votingPeriod: fundDeepCopy?.votingPeriod ?? "",
    votingDelay: fundDeepCopy?.votingDelay ?? "",
    proposalThreshold: fundDeepCopy?.proposalThreshold ?? "",
    lateQuorum: fundDeepCopy?.lateQuorum ?? "",
    proposalTitle: "",
    proposalDescription: "",

    // whitelist
    // whitelist: fundDeepCopy?.whitelist?.map((item) => item.address).join(","),
    whitelist: "",
  };

  // Store the original values for comparison
  proposalInitial = JSON.parse(
    JSON.stringify(proposal.value, stringifyBigInt),
    parseBigInt
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
  { deep: true }
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
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
    color: $color-disabled;
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
  background: linear-gradient(0deg, #111c35, #111c35),
    linear-gradient(0deg, rgba(246, 249, 255, 0.08), rgba(246, 249, 255, 0.08));
  box-shadow: 0px 0px 6px 0px #1f5fff29;

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
</style>
