<template>
  <div class="delegated-permission">
    <!-- Stepper with header -->
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      title="Delegated Permissions Proposal"
      submit-label="Create Proposal"
      :submit-event="submitProposal"
      :is-submit-loading="loading"
      @fields-changed="contractMethodChanged"
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
              <span>Create a Delegated Permission Proposal</span>
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
    </UiStepper>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { encodeFunctionCall } from "web3-eth-abi";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap,
  proposalRoleModMethodAbiMap,
  proposalRoleModMethodStepsMap,
} from "~/types/enums/delegated_permission";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { prepRoleModEntryInput } from "~/composables/parseNavMethodDetails";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const loading = ref(false);

const router = useRouter();
const fundStore = useFundStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const { selectedFundSlug } = toRefs(useFundStore());
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

const defaultMethod = formatInputToObject(
  proposalRoleModMethodStepsMap.scopeFunction,
);

const delegatedEntry = ref([
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
      },
    ],
  },
]);

const fieldsMap = ref(DelegatedPermissionFieldsMap);

function formatInputToObject(input: any) {
  /*
  input parameter is an actual function ABI from the RolesFull.json RoleMod contract.
   */
  const result = {} as any;
  console.log("input: ", input);

  input?.forEach((item: any) => {
    const { key, type, isArray } = item;
    let value;

    // Determine the default value based on the type
    switch (type) {
      case "number":
        value = "";
        break;
      case "text":
        value = "";
        break;
      case "select":
        value = item.defaultValue;
        break;
      case "checkbox":
        value = false;
        break;
      default:
        value = "";
    }

    // If the field is an array, we need to wrap the value in an array
    if (isArray) {
      value = [value];
    }

    result[key] = value;
  });

  return result;
}

// we need to change the inputs based on the contractMethod
const contractMethodChanged = (
  mainStepName: any,
  subStepIndex: any,
  step: any,
) => {
  // we need to formatInputToObject for the new substep inputs based on the contractMethod
  const newInput = formatInputToObject(
    proposalRoleModMethodStepsMap[step.contractMethod],
  );
  newInput.isValid = false;

  const mainStepIndex = delegatedEntry.value.findIndex(
    (entry) => entry.stepName === mainStepName,
  );
  if (mainStepIndex === -1) {
    console.error("Main step not found");
    return;
  }

  const currentInputs = delegatedEntry.value[mainStepIndex].steps[subStepIndex];
  if (!currentInputs) {
    console.error("Substep not found");
    return;
  }

  const keysToDelete = Object.keys(currentInputs).filter(
    (key) => key !== "contractMethod",
  );

  // check if currentInputs has the same keys as newInput
  // if it does, we don't need to do anything
  const hasSameKeys = Object.keys(newInput).every(
    (key) => key in currentInputs,
  );
  if (hasSameKeys) {
    return;
  }

  keysToDelete.forEach((key) => {
    delete currentInputs[key];
  });

  Object.assign(currentInputs, newInput); // add new input to the current inputs
};

const submitProposal = async () => {
  const transactions = delegatedEntry.value.find(
    (step) => step.stepName === DelegatedStep.Setup,
  )?.steps as any[];
  const details = delegatedEntry.value.find(
    (step) => step.stepName === DelegatedStep.Details,
  )?.steps[0];
  if (!details || !transactions?.length) return;

  const roleModAddress = await fundStore.getRoleModAddress();

  console.log(toRaw(transactions));
  console.log(toRaw(details));
  const encodedRoleModEntries = [];
  const targets = [];
  const gasValues = [];
  // TODO this code is almost a complete duplicate of prepRoleModEntryInput and can be refactored...
  //   this version is slightly more dynamic as it gets function ABI by function name, instead of index value, but
  //   input data types differ.... we have to unify them and use typescript types

  for (let i = 0; i < transactions.length; i++) {
    const trx = transactions[i];
    // Make sure function parameters are in the correct order, take them from function ABI and copy from the trx data
    // that was filled from the form inputs. Then prepare data, parsing/casting to correct types.
    const roleModFunctionData = proposalRoleModMethodStepsMap[
      trx.contractMethod
    ]
      .filter((method: any) => method.key !== "contractMethod")
      .map((method: any) =>
        prepRoleModEntryInput({
          ...method,
          data: trx[method.key],
        }),
      );
    const encodedRoleModFunction = encodeFunctionCall(
      proposalRoleModMethodAbiMap[trx.contractMethod],
      roleModFunctionData,
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0);
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
      .on("transactionHash", (hash: string) => {
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
</style>
