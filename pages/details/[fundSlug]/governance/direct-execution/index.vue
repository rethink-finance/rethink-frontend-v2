<template>
  <div class="direct_execution">
    <!-- Stepper with header -->
    <UiStepper
      :entry="executionEntry"
      :fields-map="fieldsMap"
      title="Direct Execution Proposal"
      submit-label="Create Proposal"
      tooltip-text="Create a Direct Execution Proposal"
      :submit-event="submitProposal"
      :is-submit-loading="loading"
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
              <span>Create a Direct Execution Proposal</span>
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
import type { AbiFunctionFragment } from "web3";
import { useRouter } from "vue-router";
import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import {
  DirectExecutionFieldsMap,
  ExecutionStep,
  ExecutionStepMap,
} from "~/types/enums/direct_execution";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import SafeMultiSendCallOnly from "~/assets/contracts/safe/SafeMultiSendCallOnly.json";
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
const { selectedFundSlug } = storeToRefs(fundStore);
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
  {
    title: "Direct Execution",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/governance/dirext-execution`,
  },
];

const executionEntry = ref([
  {
    stepName: ExecutionStep.Setup,
    stepLabel: ExecutionStepMap[ExecutionStep.Setup].name,
    formTitle: ExecutionStepMap[ExecutionStep.Setup].formTitle,
    formText: ExecutionStepMap[ExecutionStep.Setup].formText,

    stepDefaultValues: {
      rawTxData: "",
      gasToSendWithTransaction: "",
      addressOfContractInteraction: "",
      operation: "",
    },

    multipleSteps: true,
    subStepLabel: "Execution",
    steps: [
      {
        rawTxData: "",
        gasToSendWithTransaction: "",
        addressOfContractInteraction: "",
        operation: "",
      },
    ] as any[],
  },
  {
    stepName: ExecutionStep.Details,
    stepLabel: ExecutionStepMap[ExecutionStep.Details].name,
    formTitle: ExecutionStepMap[ExecutionStep.Details].formTitle,

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
const fieldsMap = ref(DirectExecutionFieldsMap);

const submitProposal = async () => {
  const transactions = executionEntry.value.find(
    (step) => step.stepName === ExecutionStep.Setup,
  )?.steps as any[];
  const details = executionEntry.value.find(
    (step) => step.stepName === ExecutionStep.Details,
  )?.steps[0];
  if (!details || !transactions?.length) return;

  console.log(toRaw(transactions));
  console.log(toRaw(details));

  const to = web3Store.safeMultiSendCallOnlyToAddress(fundStore.fundChainId);
  console.log("to address: ", to);
  const multisendAbiJSON = SafeMultiSendCallOnly.abi[0];
  const processedTxs = [];
  const targets = [];
  const gasValues = [];

  // execTransaction function
  const execTransactionABI = GnosisSafeL2JSON.abi[29] as AbiFunctionFragment;

  const signature =
    "0x000000000000000000000000" +
    fundStore.fund?.governorAddress.slice(2) +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "01";
  for (const i in transactions) {
    const trx = transactions[i];
    console.log("tx:", i, trx);
    const filteredTxData = encodeFunctionCall(
      multisendAbiJSON,
      [trx.rawTxData],
    );

    const formatSafeTxInput = [
      trx.addressOfContractInteraction, // MultiSendCallOnly
      0, // value
      filteredTxData, // data
      parseInt(trx.operation), // operation
      parseInt(trx.gasToSendWithTransaction), // safeTxGas
      0, // baseGas
      0, // gasPrice
      ethers.ZeroAddress, // gasToken
      ethers.ZeroAddress, // refundReceiver
      signature,
    ];
    const filteredFinalTxData = encodeFunctionCall(
      execTransactionABI,
      formatSafeTxInput,
    );

    processedTxs.push(filteredFinalTxData);
    targets.push(fundStore.fund?.safeAddress);
    gasValues.push(0);
  }
  console.log(
    "propose:",
    JSON.stringify(
      [
        targets,
        gasValues,
        processedTxs,
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
    processedTxs,
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
            "The proposal transactions was successful. " +
              "You can now vote on the proposal in the governance page.",
          );
          router.push(`/details/${selectedFundSlug.value}/governance`);
        } else {
          toastStore.errorToast(
            "The proposal transaction has failed. Please contact the Rethink Finance support.",
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
