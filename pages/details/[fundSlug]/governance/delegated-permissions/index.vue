<template>
  <div>
    <FundGovernanceDelegationNotice />

    <FundGovernanceDelegatedPermissions
      v-model="delegatedPermissionsEntry"
      :fields-map="delegatedPermissionFieldsMap"
      :chain-id="fundStore.selectedFundChain"
      :safe-address="fundStore.fund?.safeAddress ?? ''"
      submit-label="Create Proposal"
      class="delegated-permission"
      :submit-disabled="!canCreateProposal"
      :submit-disabled-reason="NO_DELEGATES_TITLE"
      @submit="submitProposal"
      @entry-updated="entryUpdated"
    >
      <template #subtitle>
        <UiTooltipClick location="right" :hide-after="6000">
          <Icon
            icon="material-symbols:info-outline"
            class="info-icon"
            width="1.5rem"
          />
          <template #tooltip>
            <div class="tooltip__content">
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </div>
          </template>
        </UiTooltipClick>
      </template>
    </FundGovernanceDelegatedPermissions>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  DelegatedPermissionFieldsMap,
  DelegatedPermissionFieldsMapV2,
  DelegatedStep,
  DelegatedStepMap,
  prepPermissionsProposalData,
  proposalRoleModMethodStepsMap,
  proposalRoleModMethodStepsMapV2,
} from "~/types/enums/delegated_permission";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import {
  NO_DELEGATES_TITLE,
  useProposalDelegation,
} from "~/composables/governance/useProposalDelegation";
import {
  toProposalCalls,
  useProposalPreflight,
} from "~/composables/governance/useProposalPreflight";
import { wrapProposalThroughSafe } from "~/composables/governance/safeExecution";
import { useRolesModifierProfile } from "~/composables/permissions/rolesModifierProfile";
import { RolesVersion } from "~/types/enums/roles_version";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const loading = ref(false);

const router = useRouter();
const fundStore = useFundStore();
const toastStore = useToastStore();
const { selectedFundSlug } = storeToRefs(useFundStore());
const { canCreateProposal, assertCanCreateProposal } = useProposalDelegation();
const { runPreflight } = useProposalPreflight();
const { profile: rolesProfile, ensureProfile } = useRolesModifierProfile();
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Delegated Permission",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  },
];
/**
 * The modifier generation decides both the form (which functions and
 * parameters exist) and the encoding. It is probed on the modifier itself;
 * the vault's factory flag only stands in until the probe answers.
 */
const rolesVersion = computed<RolesVersion>(
  () =>
    rolesProfile.value?.version ??
    (fundStore.fund?.fundFactoryContractV2Used
      ? RolesVersion.V2
      : RolesVersion.V1),
);
const delegatedPermissionFieldsMap = computed(() =>
  rolesVersion.value === RolesVersion.V2
    ? DelegatedPermissionFieldsMapV2
    : DelegatedPermissionFieldsMap,
);
const defaultMethodFor = (version: RolesVersion) =>
  formatInputToObject(
    (version === RolesVersion.V2
      ? proposalRoleModMethodStepsMapV2
      : proposalRoleModMethodStepsMap
    ).scopeFunction,
  );
const defaultMethod = defaultMethodFor(rolesVersion.value);

const delegatedPermissionsEntry = ref([
  {
    stepName: DelegatedStep.Setup,
    stepLabel: DelegatedStepMap[DelegatedStep.Setup].name,
    formTitle: DelegatedStepMap[DelegatedStep.Setup].formTitle,
    formText: DelegatedStepMap[DelegatedStep.Setup].formText,

    // default value when adding a new sub step
    stepDefaultValues: JSON.parse(JSON.stringify(defaultMethod)),

    subStepKey: "contractMethod",
    multipleSteps: true,
    subStepLabel: "Permission",
    // default values for the first sub step
    steps: [defaultMethod],
  },
  {
    stepName: DelegatedStep.Details,
    stepLabel: DelegatedStepMap[DelegatedStep.Details].name,
    formTitle: DelegatedStepMap[DelegatedStep.Details].formTitle,
    multipleSteps: false,
    stepDefaultValues: {
      proposalTitle: "",
      proposalDescription: "",
    },
    steps: [
      {
        proposalTitle: "",
        proposalDescription: "",
        transactionsOverview: "",
        transactionsRawJSON: "",
      },
    ],
  },
]);

// TODO this is not a good way to do that but the stepper and StepperFields
//  should not be implemented like that, mutating props inside but instead they
//  should be correctly emitting events. But it's a lot of refactor to fix that
//  now.
const entryUpdated = (val: any) => {
  delegatedPermissionsEntry.value = val;
};

// The probe usually answers after the form is built with the factory-flag
// guess. When it disagrees, the sub-step fields belong to the other ABI:
// start the setup step over with the right default rather than let a V1
// form be encoded for a V2 modifier (or the reverse).
watch(rolesVersion, (version, previous) => {
  if (version === previous) return;
  const fresh = defaultMethodFor(version);
  const setup = delegatedPermissionsEntry.value.find(
    (step) => step.stepName === DelegatedStep.Setup,
  ) as any;
  if (!setup) return;
  setup.stepDefaultValues = JSON.parse(JSON.stringify(fresh));
  setup.steps = [fresh];
});

const submitProposal = async () => {
  // Guards the click as well as the button: the delegate read can still be in
  // flight when the last step is reached.
  if (!(await assertCanCreateProposal())) return;

  console.log("submit", delegatedPermissionsEntry.value);
  const transactions = delegatedPermissionsEntry.value.find(
    (step) => step.stepName === DelegatedStep.Setup,
  )?.steps as any[];
  const details = delegatedPermissionsEntry.value.find(
    (step) => step.stepName === DelegatedStep.Details,
  )?.steps[0];
  if (!details || !transactions?.length) return;

  const profile = await ensureProfile();
  const roleModAddress = profile?.address ?? "";
  if (!roleModAddress || !profile?.version) {
    toastStore.errorToast(
      "The vault's Roles modifier could not be resolved, so no permission proposal can be encoded for it.",
      10000,
    );
    return;
  }

  // Governance proposals call the Roles modifier directly while the governor
  // owns it. After the one-time activation (transferOwnership to the Safe)
  // the Safe owns it; the governor still controls the Safe, so each action
  // is executed AS the Safe (Safe.execTransaction with the governor's
  // pre-validated signature). Only a modifier owned by something the governor
  // does not control is refused.
  if (profile.owner && !profile.governorOwned && !profile.safeOwnedAndControlled) {
    toastStore.errorToast(
      "The Roles modifier is owned by neither the governor nor a Safe the " +
        "governor controls, so a governance proposal cannot change its " +
        "permissions.",
      10000,
    );
    return;
  }

  console.log(toRaw(transactions));
  console.log(toRaw(details));
  let encoded: ReturnType<typeof prepPermissionsProposalData>;
  try {
    encoded = prepPermissionsProposalData(
      roleModAddress,
      transactions,
      profile.version,
    );
  } catch (error: any) {
    toastStore.errorToast(error?.message ?? String(error), 10000);
    return;
  }
  let { encodedRoleModEntries, targets, gasValues } = encoded;
  if (!profile.governorOwned) {
    const wrapped = wrapProposalThroughSafe(
      { targets, gasValues, calldatas: encodedRoleModEntries },
      profile.safe,
      fundStore.fund?.governorAddress ?? "",
    );
    targets = wrapped.targets;
    gasValues = wrapped.gasValues;
    encodedRoleModEntries = wrapped.calldatas;
  }
  console.log(
    "propose:",
    JSON.stringify(
      [
        targets,
        gasValues,
        encodedRoleModEntries,
        JSON.stringify({
          title: details?.proposalTitle,
          description: details?.proposalDescription,
        }),
      ],
      null,
      2,
    ),
  );

  if (
    !(await runPreflight(toProposalCalls(targets, encodedRoleModEntries), {
      address: roleModAddress,
      version: profile.version,
    }))
  ) {
    return;
  }
  loading.value = true;

  const proposalData = [
    targets,
    gasValues,
    encodedRoleModEntries,
    JSON.stringify({
      title: details?.proposalTitle,
      description: details?.proposalDescription,
    }),
  ];

  try {
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
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
.delegated-permission-stepper {
  :deep(.main_header__title) {
    width: 100%;
  }
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 70%;
}
.tooltip {
  &__content {
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

.info-icon {
  cursor: pointer;
  display: flex;
  color: $color-text-irrelevant;
}
.checkbox-keep-existing-permissions {
  display: flex;
  flex-direction: row-reverse;

  :deep(.v-selection-control) {
    flex-direction: row-reverse;
  }
}
</style>
