<template>
  <FundGovernanceDelegatedPermissions
    ref="delegatedPermissionsRef"
    v-model="delegatedPermissionsEntry"
    v-model:allowManagerToSendFundsToFundContract="allowManagerToSendFundsToFundContract"
    :fields-map="DelegatedPermissionFieldsMap"
    submit-label="Store Permissions"
    title="Permissions"
    :always-show-last-step="true"
    @entry-updated="entryUpdated"
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
import { encodeFunctionCall, encodeParameter } from "web3-eth-abi";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap, prepPermissionsProposalData, proposalRoleModMethodAbiMap,
  proposalRoleModMethodStepsMap,
} from "~/types/enums/delegated_permission";
import { useToastStore } from "~/store/toasts/toast.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import { GovernableFund } from "assets/contracts/GovernableFund";
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const { chainId, fundInitCache } = toRefs(createFundStore);

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

// TODO this is not a good way to do that but the stepper and StepperFields
//  should not be implemented like that, mutating props inside but instead they
//  should be correctly emitting events. But it's a lot of refactor to fix that
//  now.
const entryUpdated = (val: any) => {
  delegatedPermissionsEntry.value = val;
}

const storePermissions = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  console.log("fundInitCacheSettings", fundInitCacheSettings)
  console.log("delegatedPermissionsEntry", delegatedPermissionsEntry.value)

  if (!fundInitCache?.value?.rolesModifier) {
    console.error(
      "Something went wrong while storing permissions. " +
      "Missing fund init cache role modifier address", fundInitCache,
    )
    return toastStore.errorToast(
      "Something went wrong while storing permissions. " +
      "Missing fund init cache role modifier address.",
    )
  }

  // TODO transactions dont get updated... when imported raw
  const transactions = delegatedPermissionsEntry.value.find(
    (step) => step.stepName === DelegatedStep.Setup,
  )?.steps as any[];
  if (!transactions?.length) return;
  loading.value = true;

  const roleModAddress = fundInitCache?.value?.rolesModifier;
  console.log("roleModAddress", roleModAddress);
  console.log("transactions", toRaw(transactions));

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

  // TODO allowManagerToSendFundsToFundContract permissions
  /*
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
    if (!fundInitCache?.value?.fundContractAddr) {
      console.error(
        "Something went wrong while generating permissions to allow manager to send funds to fund contract. " +
        "Missing fundInitCache.fundAddress", fundInitCache?.value,
      )
      loading.value = false;
      return toastStore.errorToast(
        "Something went wrong while generating permissions to allow manager to send funds to fund contract." +
        "Was fund initialized correctly? Missing fund address in fund cache.",
      )
    }
    if (!fundInitCacheSettings?.baseToken) {
      console.error(
        "Something went wrong while generating permissions to allow manager to send funds to fund contract. " +
        "Missing fundInitCache.baseToken", fundInitCache?.value,
      )
      loading.value = false;
      return toastStore.errorToast(
        "Something went wrong while generating permissions to allow manager to send funds to fund contract." +
        "Was fund initialized correctly? Missing base token address in fund cache.",
      )
    }
    targets.push(roleModAddress);
    gasValues.push(0);
    const byteEncodedFundAddress = encodeParameter("bytes", fundInitCache?.value?.fundContractAddr);

    const encodedRoleModFunction = encodeFunctionCall(
      proposalRoleModMethodAbiMap.scopeParameter,
      [
        "1", // role
        fundInitCacheSettings?.baseToken, // targetAddress, base token contract address
        "0xa9059cbb", // functionSig
        "0", // paramIndex
        "0", // paramComp
        byteEncodedFundAddress, // compValue, newly created fund contract address
      ],
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    // TODO add scopeTarget permission also! with target baseToken
    console.warn("encodedRoleModFunction", encodedRoleModFunction);
  }
  // TODO allowManagerToCollectFees permissions also

  const proposalData = [
    targets,
    gasValues,
    encodedRoleModEntries,
  ];
  const fundFactoryContract = web3Store.chainContracts[chainId.value]?.fundFactoryContract;

  try {
    console.log("PROPOSAL DATA", proposalData);
    await fundFactoryContract
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
