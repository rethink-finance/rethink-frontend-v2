<template>
  <div class="direct_execution">
    <!-- Stepper with header -->
    <UiStepper
      :entry="executionEntry"
      :fields-map="fieldsMap"
      title="Direct Execution Proposal"
      submit-label="Create Proposal"
      :submit-event="submitProposal"
      :is-submit-loading="loading"
    />
  </div>
</template>

<script setup lang="ts">
import type { AbiFunctionFragment } from "web3";
import {
  DirectExecutionFieldsMap,
  ExecutionStep,
  ExecutionStepMap,
} from "~/types/enums/direct_execution";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { useFundsStore } from "~/store/funds.store";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import SafeMultiSendCallOnly from "~/assets/contracts/safe/SafeMultiSendCallOnly.json";
import { useWeb3Store } from "~/store/web3.store";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const loading = ref(false);

const fundStore = useFundStore();
const fundsStore = useFundsStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const { selectedFundSlug } = toRefs(fundStore);
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
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
  const transactions = executionEntry.value.find(step => step.stepName === ExecutionStep.Setup)?.steps as any[];
  const details = executionEntry.value.find(step => step.stepName === ExecutionStep.Details)?.steps[0];
  if (!web3Store.web3 || !details || !transactions?.length) return;

  console.log(toRaw(transactions));
  console.log(toRaw(details));

  const to = fundsStore.safeMultiSendCallOnlyToAddress;
  console.log("to address: ", to);
  const multisendAbiJSON = SafeMultiSendCallOnly.abi[0];
  const processedTxs = [];
  const targets = [];
  const gasValues = [];

  // execTransaction function
  const execTransactionABI = GnosisSafeL2JSON.abi[29] as AbiFunctionFragment;

  const signature = "0x000000000000000000000000" + fundStore.fund?.governorAddress.slice(2) + "0000000000000000000000000000000000000000000000000000000000000000" + "01";
  for (const i in transactions) {
    const trx = transactions[i];
    console.log("tx:", i, trx);
    const filteredTxData = web3Store.web3.eth.abi.encodeFunctionCall(multisendAbiJSON, [trx.rawTxData]);

    const formatSafeTxInput = [
      trx.addressOfContractInteraction,// MultiSendCallOnly
      0,// value
      filteredTxData,// data
      parseInt(trx.operation),// operation
      parseInt(trx.gasToSendWithTransaction),// safeTxGas
      0,// baseGas
      0,// gasPrice
      "0x0000000000000000000000000000000000000000",// gasToken
      "0x0000000000000000000000000000000000000000",// refundReceiver
      signature,
    ];
    const filteredFinalTxData = web3Store.web3.eth.abi.encodeFunctionCall(execTransactionABI, formatSafeTxInput);

    processedTxs.push(filteredFinalTxData);
    targets.push(fundStore.fund?.safeAddress);
    gasValues.push(0);
  }
  console.log("propose:",
    JSON.stringify(
      [
        targets,
        gasValues,
        processedTxs,
        JSON.stringify({
          title: details?.proposalTitle,
          description: details?.proposalDescription,
        }),
      ], null, 2),
  );
  loading.value = true;

  try {
    await fundStore.fundGovernorContract.methods.propose(
      targets,
      gasValues,
      processedTxs,
      JSON.stringify({
        title: details?.proposalTitle,
        description: details?.proposalDescription,
      }),
    ).send({
      from: fundStore.activeAccountAddress,
      maxPriorityFeePerGas: undefined,
      maxFeePerGas: undefined,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The proposal transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);
      if (receipt.status) {
        toastStore.successToast(
          "The proposal transactions was successful. " +
          "You can now vote on the proposal in the governance page.",
        );
      } else {
        toastStore.errorToast(
          "The proposal transaction has failed. Please contact the Rethink Finance support.",
        );
      }
      loading.value = false;
    }).on("error", (error: any) => {
      console.error(error);
      loading.value = false;
      toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
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
</style>
