<template>
  <FundGovernanceDelegatedPermissions
    ref="delegatedPermissionsRef"
    v-model="delegatedPermissionsEntry"
    v-model:allowManagerToSendFundsToFundContract="allowManagerToSendFundsToFundContract"
    :fields-map="DelegatedPermissionFieldsMap"
    submit-label="Store Permissions"
    title="Permissions"
    :always-show-last-step="true"
    @submit="storePermissions"
  >
    <template #pre-content>
      <div class="management">
        <div class="management__row">
          <div>
            Allow manager to send funds to the fund contract to settle flows
          </div>
          <v-switch
            v-model="allowManagerToSendFundsToFundContract"
            color="primary"
            hide-details
          />
        </div>
        <div class="management__row">
          <div>
            Allow manager to collect fees based on default performance fee contract
          </div>
          <v-switch
            v-model="allowManagerToCollectFees"
            color="primary"
            hide-details
          />
        </div>
      </div>
    </template>
  </FundGovernanceDelegatedPermissions>
</template>

<script setup lang="ts">
import { encodeFunctionCall } from "web3-eth-abi";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap, prepPermissionsProposalData, proposalRoleModMethodAbiMap,
  proposalRoleModMethodStepsMap,
} from "~/types/enums/delegated_permission";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
const fundStore = useFundStore();
const toastStore = useToastStore();


const loading = ref(false);
const allowManagerToSendFundsToFundContract = ref(false);
const allowManagerToCollectFees = ref(false);
const defaultMethod = formatInputToObject(
  proposalRoleModMethodStepsMap.scopeFunction,
);
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
]);

// TODO take from cache & roleModAddress
const fundAddress = "0x00a4dcbbb7eb5d0c4ef33ab9763dde5cd91a4b10";
const fundBaseTokenAddress = "0x00a4dcbbb7eb5d0c4ef33ab9763dde5cd91a4b10";

const storePermissions = async () => {
  console.log("storePermissions", delegatedPermissionsEntry.value)
  const transactions = delegatedPermissionsEntry.value.find(
    (step) => step.stepName === DelegatedStep.Setup,
  )?.steps as any[];
  if (!transactions?.length) return;

  // TODO take cached role mod address that was generated now
  const roleModAddress = await fundStore.getRoleModAddress();
  console.log("roleModAddress", roleModAddress);
  console.log(toRaw(transactions));

  const { encodedRoleModEntries, targets, gasValues } = prepPermissionsProposalData(
    roleModAddress,
    transactions,
  );
  console.log(
    "storePermissions data:",
    JSON.stringify(
      [
        targets,
        gasValues,
        encodedRoleModEntries,
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
  ];

  // TODO allowManagerToSendFundsToFundContract permissions
  /*
    {
      "inputs": [
        {
          "internalType": "uint16",
          "name": "role",
          "type": "uint16"
        },
        {
          "internalType": "address",
          "name": "targetAddress",
          "type": "address"
        },
        {
          "internalType": "bytes4",
          "name": "functionSig",
          "type": "bytes4"
        },
        {
          "internalType": "uint256",
          "name": "paramIndex",
          "type": "uint256"
        },
        {
          "internalType": "enum ParameterType",
          "name": "paramType",
          "type": "uint8"
        },
        {
          "internalType": "enum Comparison",
          "name": "paramComp",
          "type": "uint8"
        },
        {
          "internalType": "bytes",
          "name": "compValue",
          "type": "bytes"
        }
      ],
      "name": "scopeParameter",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    Example:
      {
    "role": "1",
    "targetAddress": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    "functionSig": "0xa9059cbb",
    "paramIndex": "0",
    "paramType": "0",
    "paramComp": "0",
    "compValue": "0x00000000000000000000000000a4dcbbb7eb5d0c4ef33ab9763dde5cd91a4b10"
  }
   */
  if (allowManagerToSendFundsToFundContract.value) {
    targets.push(roleModAddress);
    gasValues.push(0);
    const encodedRoleModFunction = encodeFunctionCall(
      proposalRoleModMethodAbiMap.scopeParameter,
      [
        "1", // role
        fundBaseTokenAddress, // targetAddress, base token contract address
        "0xa9059cbb", // functionSig
        "0", // paramIndex
        "0", // paramComp
        fundAddress, // compValue, newly created fund contract address
      ],
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    console.warn("encodedRoleModFunction", encodedRoleModFunction);
  }
  // TODO allowManagerToCollectFees permissions also

  try {
    await fundStore.fundContract
      .send("submitPermissions", {}, ...proposalData)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Store permissions transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Permissions stored successfully.");
        } else {
          toastStore.errorToast(
            "Storing permissions has failed. Please contact the Rethink Finance support.",
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
</script>


<style scoped lang="scss">
.management {
  margin-bottom: 1rem;
  &__row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
