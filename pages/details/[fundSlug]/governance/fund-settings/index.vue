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

      <v-btn
        class="button--primary"
        :type="isLastStep ? 'submit' : 'button'"
        :loading="isSubmitLoading"
        @click="handleButtonClick"
        :disabled="isLastStep && !accountStore.isConnected"
      >
        {{ isLastStep ? submitLabel : "Next" }}
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

            <v-col
              v-for="(field, index) in section.fields"
              :key="index"
              cols="12"
            >
              <div class="toggleable_group" v-if="field.isTogglable">
                <div class="toggleable_group__toggle">
                  <v-switch
                    v-model="field.isToggleOn"
                    color="primary"
                    hide-details
                  />
                </div>

                <div class="toggleable_group__fields">
                  <v-col
                    cols="6"
                    v-for="(subField, index) in field.fields"
                    :key="index"
                  >
                    <UiField
                      :field="subField"
                      v-model="proposal[subField.key]"
                      :is-disabled="!field.isToggleOn"
                    />
                  </v-col>
                </div>
              </div>
              <div v-else>
                <UiField :field="field" v-model="proposal[field.key]" />
              </div>
            </v-col>
          </v-row>
        </div>
      </v-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import {
  FundSettingProposalFieldsMap,
  ProposalStep,
  ProposalStepMap,
} from "~/types/enums/fund_setting_proposal";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);
const fundStore = useFundStore();
const toastStore = useToastStore();
const router = useRouter();

const { selectedFundSlug } = toRefs(fundStore);
const isSubmitLoading = ref(false);
const submitLabel = "Submit Proposal";

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

const activeStep = ref(ProposalStep.Setup);

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
          FundSettingProposalFieldsMap[section.name]?.map((field) => ({
            ...field,
            value: proposal.value[field.key],
          })) ?? [],
      })) ?? [],
  },
]);

const allFieldsValid = computed(() =>
  proposalEntry.value.every((step) => {
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
  })
);

const isLastStep = computed(() => {
  return activeStep.value === ProposalStep.Details;
});

const tooltipClick = () => {
  toastStore.addToast("This is a fund settings proposal.");
};

const handleButtonClick = () => {
  isLastStep.value ? submit() : nextStep();
};

const submit = () => {
  if (formIsValid.value) {
    toastStore.successToast("Proposal submitted successfully");
    router.push(`/details/${selectedFundSlug.value}/governance`);
  } else {
    form.value?.validate();
    toastStore.warningToast("Please fill all the required fields");
  }
};

const nextStep = () => {
  if (formIsValid.value) {
    activeStep.value = ProposalStep.Details;
  } else {
    form.value?.validate();
    toastStore.warningToast("Please fill all the required fields");
  }
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const form = ref(null);
const formIsValid = ref(false);
</script>

<style scoped lang="scss">
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
:deep(.v-expansion-panel-title) {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.method_details_title {
  display: flex;
  align-items: center;
  gap: 1rem;
  letter-spacing: 0.02625rem;
  font-weight: 500;
  color: $color-text-irrelevant;
}
.method_details_status {
  color: $color-warning;

  &--valid {
    color: $color-success;
  }
}

.toggleable_group {
  &__toggle {
    display: flex;
    justify-content: flex-end;
  }

  &__fields {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>
