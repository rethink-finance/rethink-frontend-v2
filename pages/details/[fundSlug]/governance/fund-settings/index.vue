<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Fund Settings Proposal

        <Icon
          icon="material-symbols:info-outline"
          class="main_header__info-icon"
          width="1.5rem"
          @click="tooltipClick"
        />
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

    <div class="main_card stepper__step-content">
      <v-form ref="form">
        <div v-for="(step, index) in proposalEntry" :key="index">
          <v-row
            v-if="step.stepName === activeStep"
            v-for="(section, index) in step.sections"
            :key="index"
          >
            {{ section.name }}

            <div class="fields">
              <v-col
                v-for="(field, index) in section.fields"
                :key="index"
                :cols="field?.cols ?? 12"
              >
                <div class="toggleable_group" v-if="field.isTogglable">
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
                  <!-- TODO: show info here if field has info -->
                </div>
              </v-col>
            </div>
          </v-row>
        </div>
      </v-form>
    </div>
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
} from "~/types/enums/fund_setting_proposal";
import type IFund from "~/types/fund";
import type BreadcrumbItem from "~/types/ui/breadcrumb";

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

// TODO: implement undo changes that will reset form with initial values
let proposalInitial: Record<string, any> = {}; // This will store initial values

// TODO: rename keys to match the proposal keys from the API
const proposal = ref({
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

const proposalEntry = ref([
  {
    stepName: ProposalStep.Setup,
    stepLabel: ProposalStepMap[ProposalStep.Setup]?.name ?? "",

    sections:
      ProposalStepMap[ProposalStep.Setup]?.sections?.map((section) => ({
        name: section?.name ?? "",
        fields:
          FundSettingProposalFieldsMap[section.key]?.map((field) => {
            // if field is togglable, that means that more fields are in relation and they can be toggled
            if (field.isTogglable) {
              field.fields.map((subField) => {
                return {
                  ...subField,
                  value: proposal.value[subField.key],
                };
              });
            }
            return {
              ...field,
              value: proposal.value[field.key],
            };
          }) ?? [],
      })) ?? [],
  },

  {
    stepName: ProposalStep.Details,
    stepLabel: ProposalStepMap[ProposalStep.Details]?.name ?? "",

    sections:
      ProposalStepMap[ProposalStep.Details]?.sections?.map((section) => ({
        name: section?.name ?? "",
        fields:
          FundSettingProposalFieldsMap[section.key]?.map((field) => {
            // if field is togglable, that means that more fields are in relation and they can be toggled
            if (field.isTogglable) {
              field.fields.map((subField) => {
                return {
                  ...subField,
                  value: proposal.value[subField.key],
                };
              });
            }
            return {
              ...field,
              value: proposal.value[field.key],
            };
          }) ?? [],
      })) ?? [],
  },
]);

const checkIfAllFieldsValid = () => {
  const output = proposalEntry.value.every((step) => {
    return step.sections.every((section) => {
      if (section.isTogglable) {
        return section.fields.every((field) => {
          return field.fields.every((subField) => {
            return (
              subField?.rules?.every((rule) => {
                return rule(subField.value) === true;
              }) ?? true
            );
          });
        });
      } else {
        return section.fields.every((field) => {
          return (
            field?.rules?.every((rule) => {
              return rule(field.value) === true;
            }) ?? true
          );
        });
      }
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

const tooltipClick = () => {
  toastStore.addToast("This is a fund settings proposal.");
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
    form.value?.validate();
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

const populateProposal = () => {
  const fundDeepCopy = JSON.parse(
    JSON.stringify(fund, stringifyBigInt),
    parseBigInt
  );

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
    managementFeePeriod: fundDeepCopy?.managementPeriod ?? "",
    profitManagemnetFee: fundDeepCopy?.performanceFee ?? "",
    profitManagemnetFeeRecipientAddress:
      fundDeepCopy?.performanceFeeAddress ?? "",
    profitManagementFeePeriod: fundDeepCopy?.performancePeriod ?? "",
    hurdleRate: fundDeepCopy?.performaceHurdleRateBps ?? "",
    plannedSettlementPeriod: fundDeepCopy?.plannedSettlementPeriod ?? "",
    minLiquidAssetShare: fundDeepCopy?.minLiquidAssetShare ?? "",
    governanceToken: fundDeepCopy?.governanceToken?.symbol ?? "",
    quorum: fundDeepCopy?.quorumPercentage ?? "",
    votingPeriod: fundDeepCopy?.votingPeriod ?? "",
    votingDelay: fundDeepCopy?.votingDelay ?? "",
    proposalThreshold: fundDeepCopy?.proposalThreshold ?? "",
    lateQuorum: fundDeepCopy?.lateQuorum ?? "",
  };

  // Store the original values for comparison
  proposalInitial = JSON.parse(
    JSON.stringify(proposal.value, stringifyBigInt),
    parseBigInt
  );
};

const isFieldModified = (key) => {
  const output = proposal.value[key] !== proposalInitial[key];

  return output;
};

watch(
  proposal,
  (newValue, oldValue) => {
    proposalEntry.value.forEach((step) => {
      step.sections.forEach((section) => {
        if (section.isTogglable) {
          section.fields.forEach((field) => {
            field.fields.forEach((subField) => {
              subField.value = newValue[subField.key];
            });
          });
        } else {
          section.fields.forEach((field) => {
            field.value = newValue[field.key];
          });
        }
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
  &__title {
    display: flex;
    align-items: center;
    align-content: center;
    gap: 10px;
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
  }
}
.buttons_container {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}
.toggleable_group {
  &__toggle {
    display: flex;
    justify-content: flex-end;
  }
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
</style>
