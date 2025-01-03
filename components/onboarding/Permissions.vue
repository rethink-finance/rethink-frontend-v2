<template>
  <FundGovernanceDelegatedPermissions
    ref="delegatedPermissionsRef"
    v-model="delegatedPermissionsEntry"
    :fields-map="DelegatedPermissionFieldsMap"
    submit-label="Store Permissions"
    title="Permissions"
    :always-show-last-step="true"
    @entry-updated="entryUpdated"
    @submit="storePermissions"
  >
    <template #post-steps-content>
      <div class="main-step">
        <div class="info_container">
          <div class="info_container__buttons">
            <UiLinkExternalButton
              title="View OIV Permissions"
              :href="gnosisPermissionsUrl"
            />
          </div>
          <p class="info_container__text">
            Having trouble reading permissions?<br>
            <a
              class="info_container__link"
              href="https://docs.rethink.finance/rethink.finance"
              target="_blank"
            >Learn more about permissions here</a>.
          </p>
        </div>
        <div class="info_container mt-6">
          <p class="info_container__text">
            <strong>Safe Contract:</strong>
            {{ fundSettings?.safe || "N/A" }}
          </p>
        </div>
      </div>
    </template>

    <template #pre-content>
      <div class="management">
        <div class="management__row">
          <div>
            Prepopulate permissions to allow manager to send funds to the fund contract to settle flows
          </div>
          <v-switch
            v-model="allowManagerToSendFundsToFundContract"
            color="primary"
            hide-details
          />
        </div>
        <div class="management__row">
          <div>
            Prepopulate permissions to allow manager to collect fees based on default performance fee contract
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
import { getGnosisPermissionsUrl } from "~/composables/permissions/getGnosisPermissionsUrl";
import { networksMap } from "~/store/web3/networksMap";
import { rethinkContractAddresses } from "assets/contracts/rethinkContractAddresses";
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const { fundChainId, fundInitCache, fundSettings } = toRefs(createFundStore);

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

const gnosisPermissionsUrl = computed(() => {
  if (!fundChainId.value) return "";

  getGnosisPermissionsUrl(
    networksMap[fundChainId.value]?.chainShort || "",
    fundInitCache?.value?.rolesModifier || "",
  );
});

// TODO this is not a good way to do that but the stepper and StepperFields
//  should not be implemented like that, mutating props inside but instead they
//  should be correctly emitting events. But it's a lot of refactor to fix that
//  now.
const entryUpdated = (val: any) => {
  delegatedPermissionsEntry.value = val;
}

const getAllowManagerToSendFundsToFundContractPermission = (
  baseTokenAddress: string,
): string[] => {
  const encodedRoleModEntries = [];
  const byteEncodedFundAddress = encodeParameter("bytes", fundInitCache?.value?.fundContractAddr);

  const encodedScopeParameter = encodeFunctionCall(
    proposalRoleModMethodAbiMap.scopeParameter,
    [
      "1", // role
      baseTokenAddress, // targetAddress, base token contract address
      "0xa9059cbb", // functionSig, transfer
      "0", // paramIndex
      "0", // paramType
      "0", // paramComp
      byteEncodedFundAddress, // compValue, newly created fund contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeParameter);

  // Add scopeTarget permission also with target baseToken
  const encodedScopeTarget = encodeFunctionCall(
    proposalRoleModMethodAbiMap.scopeTarget,
    [
      "1", // role
      baseTokenAddress, // targetAddress, base token contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeTarget);
  return encodedRoleModEntries;
}


const getAllowManagerToCollectFeesPermission = (
  fundAddress: string,
): string[] => {
  const encodedRoleModEntries: string[] = [];
  const poolPerformanceFeeAddress = rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[fundChainId.value];
  if (!poolPerformanceFeeAddress) {
    const errorMsg =  "Missing PoolPerformanceFeeBeaconProxy address. " +
        "Please contact Rethink support.";
    toastStore.errorToast(errorMsg)
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const byteEncodedPoolPerformanceFeeAddress = encodeParameter(
    "bytes",
    poolPerformanceFeeAddress,
  );

  const encodedScopeParameter = encodeFunctionCall(
    proposalRoleModMethodAbiMap.scopeParameter,
    [
      "1", // role
      fundAddress, // targetAddress, OIV contract address
      "0xec68ac8d", // functionSig
      "0", // paramIndex
      "1", // paramType
      "0", // paramComp
      byteEncodedPoolPerformanceFeeAddress, // compValue, Performance Fee Proxy Contract Address
    ],
  );
  encodedRoleModEntries.push(encodedScopeParameter);

  // Add scopeTarget permission also with target OIV contract address.
  const encodedScopeTarget = encodeFunctionCall(
    proposalRoleModMethodAbiMap.scopeTarget,
    [
      "1", // role
      fundAddress, // targetAddress, OIV contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeTarget);
  return encodedRoleModEntries;
}

const storePermissions = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  console.log("fundInitCacheSettings", fundInitCacheSettings)
  console.log("delegatedPermissionsEntry", delegatedPermissionsEntry.value)

  if (!fundInitCache?.value?.rolesModifier || !fundInitCache?.value?.fundContractAddr || !fundInitCacheSettings?.baseToken) {
    console.error("Missing fund init cache data", fundInitCache)
    loading.value = false;
    return toastStore.errorToast(
      "Something went wrong while storing permissions. " +
      "Missing fund init cache data.",
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
    const _encodedRoleModEntries = getAllowManagerToSendFundsToFundContractPermission(
      fundInitCacheSettings?.baseToken,
    );
    for (let i = 0; i < _encodedRoleModEntries.length; i++) {
      gasValues.push(0);
      targets.push(roleModAddress);
    }
    encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  // Add allowManagerToCollectFees permissions if switch button is enabled.
  if (allowManagerToCollectFees.value) {
    const _encodedRoleModEntries = getAllowManagerToCollectFeesPermission(
      fundInitCacheSettings?.fundAddress,
    );

    for (let i = 0; i < _encodedRoleModEntries.length; i++) {
      gasValues.push(0);
      targets.push(roleModAddress);
    }
    encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  const permissionsData = [
    targets,
    gasValues,
    encodedRoleModEntries,
  ];
  const fundFactoryContract = web3Store.chainContracts[fundChainId.value]?.fundFactoryContract;

  try {
    console.log("SUBMIT PERMISSIONS DATA", permissionsData);
    await fundFactoryContract
      .send("submitPermissions", {}, ...permissionsData)
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
.info_container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;

  &__text {
    font-size: $text-sm;
    color: $color-light-subtitle;
  }
  &__link {
    color: $color-primary;
    text-decoration: underline;
  }
  &__buttons {
    display: flex;
    flex-direction: column;
    gap: 15px;

    @include md {
      flex-direction: row;
    }
  }
}
</style>
