<template>
  <div class="permissions_wrapper">
    <div class="d-flex justify-center">
      <v-stepper v-model="selectedStepIndex">
        <v-stepper-header>
          <v-stepper-item
            v-for="(step, index) in permissionSteps"
            :key="index"
            :step="index + 1"
            :complete="index + 1 < selectedStepIndex"
            :value="index + 1"
          >
            <template #default>
              <div class="d-flex align-center">
                <span>{{ step }}</span>
              </div>
            </template>
          </v-stepper-item>
        </v-stepper-header>
      </v-stepper>
    </div>

    <div class="d-flex align-center justify-space-between">
      <div v-if="selectedStepIndex === 0" class="d-flex align-center">
        <div class="d-flex align-center me-6">
          <RoleSelectRole v-model="selectedRole" :roles="roles" />
        </div>
        <PermissionImportRawPermissions />
      </div>
      <v-btn
        v-if="selectedStepIndex === 0"
        class="btn_icon_center"
        type="button"
        variant="outlined"
        @click="goToPermissionsStepTwo()"
      >
        Finalize Permissions
        <v-icon right>
          mdi-chevron-right
        </v-icon>
      </v-btn>
    </div>

    <FundPermissions
      v-if="selectedStepIndex === 0"
      class="mt-6"
      :chain-id="fundChainId"
      :is-loading="isFetchingPermissions"
      :error-message="updateRoleError"
    />
    <FundGovernanceDelegatedPermissions
      v-if="selectedStepIndex === 1"
      ref="delegatedPermissionsRef"
      v-model="delegatedPermissionsEntry"
      :fields-map="DelegatedPermissionFieldsMap"
      submit-label="Save Permissions"
      title="Permissions"
      :always-show-last-step="true"
      @entry-updated="entryUpdated"
      @submit="storePermissions"
    >
      <template #title>
        <UiButtonBack
          @click="selectedStepIndex = 0"
        />
      </template>
      <template #post-steps-content>
        <div class="main-step">
          <div class="info_container">
            <div class="info_container__buttons">
              <UiLinkExternalButton
                title="View Vault Permissions"
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
  </div>
</template>

<script setup lang="ts">
import { encodeFunctionCall, encodeParameter } from "web3-eth-abi";
import { padLeft } from "web3-utils";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap, prepPermissionsProposalData, roleModWriteFunctionAbiMap,
  proposalRoleModMethodStepsMap,
} from "~/types/enums/delegated_permission";
import { useToastStore } from "~/store/toasts/toast.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import { getGnosisPermissionsUrl } from "~/composables/permissions/getGnosisPermissionsUrl";
import { networksMap } from "~/store/web3/networksMap";
import { useRoles } from "~/composables/permissions/useRoles";
import PermissionImportRawPermissions from "~/components/permission/ImportRawPermissions.vue";
import type { Role } from "~/types/zodiac-roles/role";
import { useRoleStore } from "~/store/role/role.store";
import RoleSelectRole from "~/components/role/SelectRole.vue";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import { useContractAddresses } from "~/composables/useContractAddresses";
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const roleStore = useRoleStore();

const { fundChainId, fundInitCache, fundSettings } = storeToRefs(createFundStore);
const {
  roles,
  selectedRole,
  isFetchingPermissions,
  fetchPermissions,
} = useRoles(fundChainId.value, fundInitCache?.value?.fundSettings?.fundAddress);

const updateRoleError = ref("");
const permissionSteps = ref([
  "Edit Permissions",
  "Finalize Permissions",
]);
const selectedStepIndex = ref(0);
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

// Computed
const roleModAddress = computed(() => fundInitCache?.value?.rolesModifier);
const gnosisPermissionsUrl = computed(() => {
  if (!fundChainId.value) return "";

  return getGnosisPermissionsUrl(
    networksMap[fundChainId.value]?.chainShort || "",
    roleModAddress.value || "",
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
  // transfer(address recipient, uint256 amount)
  // Parameter of transfer is address which is a static param and is 20 bytes long.
  // We have to zero pad left 20 bytes to 32 bytes and encode to bytes.
  const byteEncodedFundAddress = encodeParameter(
    "bytes32",
    // 64 hex characters = 32 bytes
    padLeft(fundInitCache?.value?.fundContractAddr as any, 64),
  );

  const encodedScopeParameter = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeParameter,
    [
      selectedRole.value?.id || "1", // role
      baseTokenAddress, // targetAddress, base token contract address
      "0xa9059cbb", // functionSig, transfer
      "0", // paramIndex
      "0", // paramType -- Static
      "0", // paramComp -- EqualTo
      byteEncodedFundAddress, // compValue, newly created fund contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeParameter);

  // Add scopeTarget permission also with target baseToken
  const encodedScopeTarget = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeTarget,
    [
      selectedRole.value?.id || "1", // role
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
  const { rethinkContractAddresses } = useContractAddresses();

  const poolPerformanceFeeAddress = rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[fundChainId.value];
  if (!poolPerformanceFeeAddress) {
    const errorMsg =  "Missing PoolPerformanceFeeBeaconProxy address. " +
        "Please contact Rethink support.";
    toastStore.errorToast(errorMsg)
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const byteEncodedPoolPerformanceFeeAddress = encodeParameter(
    "bytes32",
    padLeft(poolPerformanceFeeAddress as any, 64),
  );

  const encodedScopeParameter = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeParameter,
    [
      selectedRole.value?.id || "1", // role
      fundAddress, // targetAddress, vault contract address
      "0xec68ac8d", // functionSig
      "0", // paramIndex
      "1", // paramType -- Dynamic
      "0", // paramComp -- EqualTo
      byteEncodedPoolPerformanceFeeAddress, // compValue, Performance Fee Proxy Contract Address
    ],
  );
  encodedRoleModEntries.push(encodedScopeParameter);

  // Add scopeTarget permission also with the target vault contract address.
  const encodedScopeTarget = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeTarget,
    [
      selectedRole.value?.id || "1", // role
      fundAddress, // targetAddress, vault contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeTarget);
  return encodedRoleModEntries;
}

const goToPermissionsStepTwo = async () => {
  // TODO add loading overlay
  updateRoleError.value = "";
  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(fundChainId.value);
    selectedStepIndex.value = 1;
  } catch (e: any) {
    console.error("Failed updating role", e);
    updateRoleError.value = e.message;
  }
}

const storePermissions = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  console.log("fundInitCacheSettings", fundInitCacheSettings)
  console.log("delegatedPermissionsEntry", delegatedPermissionsEntry.value)

  if (!roleModAddress.value || !fundInitCache?.value?.fundContractAddr || !fundInitCacheSettings?.baseToken) {
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
  console.log("roleModAddress", roleModAddress.value);
  console.log("transactions", toRaw(transactions));

  const proposalData = prepPermissionsProposalData(
    roleModAddress.value,
    transactions,
  );
  console.log(
    "storePermissions data:",
    JSON.stringify(
      proposalData.encodedRoleModEntries,
      null,
      2,
    ),
  );

  if (allowManagerToSendFundsToFundContract.value) {
    const _encodedRoleModEntries = getAllowManagerToSendFundsToFundContractPermission(
      fundInitCacheSettings?.baseToken,
    );
    proposalData.encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  // Add allowManagerToCollectFees permissions if switch button is enabled.
  if (allowManagerToCollectFees.value) {
    const _encodedRoleModEntries = getAllowManagerToCollectFeesPermission(
      fundInitCacheSettings?.fundAddress,
    );
    proposalData.encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  const fundFactoryContract = web3Store.chainContracts[fundChainId.value]?.fundFactoryContract;

  try {
    console.log("SUBMIT PERMISSIONS DATA", proposalData.encodedRoleModEntries);
    await fundFactoryContract
      .send("submitPermissions", {}, proposalData.encodedRoleModEntries)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The save permissions transaction has been submitted. Please wait for confirmation.",
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

// TODO refetch permissions when user submits storePermissions
watch(
  () => [fundChainId, roleModAddress.value],
  async () => {
    console.warn("FETCH PERMS")
    await fetchPermissions(roleModAddress.value);
    console.log("fetched roles", roles.value);
    // If no roles or permissions exist, pre-populate an empty role with roleId 1
    if (!roles.value?.length) {
      // Pre-populate an empty role with roleId 1
      const roleId = "1";
      const emptyRole: Role = {
        id: roleId,
        name: roleId,
        targets: [],
        members: [],
      };
      roles.value = [emptyRole];
      selectedRole.value = emptyRole;
    }
  },
  { immediate: true },
);
</script>


<style scoped lang="scss">
.permissions_wrapper {
  padding: 0 1rem 1rem 1rem;
  border: 4px dashed $color-border-dark;
}
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
