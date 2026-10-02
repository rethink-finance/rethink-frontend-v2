<template>
  <div class="permissions_wrapper">
    <template v-if="selectedStepIndex === 0">
      <div class="perm_title_row">
        <h2 class="perm_section_title">
          Permissions
        </h2>
        <span class="perm_badge">Roles V1</span>
      </div>

      <div class="perm_role_row">
        <RoleSelectRole v-model="selectedRole" :roles="roles" />
        <PermissionImportRawPermissions />
      </div>
    </template>

    <FundPermissions
      v-if="selectedStepIndex === 0"
      class="mt-6"
      :chain-id="fundChainId"
      :is-loading="isFetchingPermissions"
      :error-message="updateRoleError"
    />
    <OnboardingVaultContractsFoot
      v-if="selectedStepIndex === 0"
      :chain-id="fundChainId"
      :safe-address="fundSettings?.safe"
      :roles-mod-address="roleModAddress"
    />

    <FundGovernanceDelegatedPermissions
      v-else-if="selectedStepIndex === 1"
      ref="delegatedPermissionsRef"
      v-model="delegatedPermissionsEntry"
      :chain-id="fundChainId"
      :safe-address="fundSettings?.safe ?? ''"
      :fields-map="delegatedPermissionFieldsMap"
      submit-label="Save Permissions"
      title="Permissions"
      :always-show-last-step="true"
      @entry-updated="entryUpdated"
      @submit="storePermissions"
    >
      <template #title>
        <UiButtonBack @click="selectedStepIndex = 0" />
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
        <PermissionsManagement
          v-model:allow-manager-to-send-funds-to-fund-contract="
            allowManagerToSendFundsToFundContract
          "
          v-model:allow-manager-to-collect-fees="allowManagerToCollectFees"
        />
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
  DelegatedStepMap,
  prepPermissionsProposalData,
  roleModWriteFunctionAbiMap,
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
import { DEFAULT_ROLE_KEY } from "~/composables/nav/generateNAVPermission";
import PermissionsManagement from "~/components/onboarding/PermissionsManagement.vue";
import {
  FUND_FLOWS_CALL_SELECTOR,
  TRANSFER_SELECTOR,
} from "~/composables/permissions/rolesV2Permissions";
import {
  buildRevokeEntriesV1,
  type IPermissionScope,
} from "~/composables/permissions/revokePermissions";

/**
 * The create flow's Permissions step on a legacy Roles V1 vault: the one
 * role's permissions in the role editor, then the delegated-permissions
 * editor with the two prepopulated switches. A Roles V2 vault never mounts
 * this; its step is OnboardingPermissions.
 */
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const roleStore = useRoleStore();

const { fundChainId, fundInitCache, fundSettings } = storeToRefs(createFundStore);
const { roles, selectedRole, isFetchingPermissions, fetchPermissions } =
  useRoles(fundChainId.value, fundInitCache?.value?.fundSettings?.fundAddress);

const updateRoleError = ref("");
const selectedStepIndex = ref(0);
const loading = ref(false);
// Roles V1's two prepopulated permissions. Both start on: they are what a
// vault normally needs to run.
const allowManagerToSendFundsToFundContract = ref(true);
const allowManagerToCollectFees = ref(true);
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
const delegatedPermissionFieldsMap = computed(() => DelegatedPermissionFieldsMap);
const roleModAddress = computed(() => fundInitCache?.value?.rolesModifier);
const gnosisPermissionsUrl = computed(() => {
  if (!fundChainId.value) return "";

  return getGnosisPermissionsUrl(
    networksMap[fundChainId.value]?.chainShort || "",
    roleModAddress.value || "",
    false,
  );
});

// TODO this is not a good way to do that but the stepper and StepperFields
//  should not be implemented like that, mutating props inside but instead they
//  should be correctly emitting events. But it's a lot of refactor to fix that
//  now.
const entryUpdated = (val: any) => {
  delegatedPermissionsEntry.value = val;
};

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
      selectedRole.value?.id || DEFAULT_ROLE_KEY, // role
      baseTokenAddress, // targetAddress, base token contract address
      "0xa9059cbb", // functionSig, transfer
      "0", // paramIndex
      "0", // paramType -- Static
      "0", // paramComp -- EqualTo
      byteEncodedFundAddress, // compValue, newly created admin contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeParameter);

  // Add scopeTarget permission also with target baseToken
  const encodedScopeTarget = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeTarget,
    [
      selectedRole.value?.id || DEFAULT_ROLE_KEY, // role
      baseTokenAddress, // targetAddress, base token contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeTarget);
  return encodedRoleModEntries;
};

const getAllowManagerToCollectFeesPermission = (
  fundAddress: string,
): string[] => {
  const encodedRoleModEntries: string[] = [];

  const byteEncodedPoolPerformanceFeeAddress = encodeParameter(
    "bytes32",
    padLeft(poolPerformanceFeeAddress.value, 64),
  );

  const encodedScopeParameter = encodeFunctionCall(
    roleModWriteFunctionAbiMap.scopeParameter,
    [
      selectedRole.value?.id || DEFAULT_ROLE_KEY, // role
      fundAddress, // targetAddress, vault contract address
      "0xec68ac8d", // functionSig "fundFlowsCall(bytes)"
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
      selectedRole.value?.id || DEFAULT_ROLE_KEY, // role
      fundAddress, // targetAddress, vault contract address
    ],
  );
  encodedRoleModEntries.push(encodedScopeTarget);
  return encodedRoleModEntries;
};

const goToPermissionsStepTwo = async () => {
  // TODO add loading overlay
  updateRoleError.value = "";

  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(
      fundChainId.value,
    );
    selectedStepIndex.value = 1;
  } catch (e: any) {
    if (e.message === "No role") {
      // No role edits were made; continue with no prepared transactions.
      permissionsProposalStore.rawTransactions = [];
      selectedStepIndex.value = 1;
    } else {
      console.error("Failed updating role", e);
      updateRoleError.value = e.message;
    }
  }
};

// The step's primary action lives in the page's sticky footer, where every
// other step's does; this is what that button calls. On the delegated editor
// (sub-step 1) the footer hides its primary via isOnFirstSubStep — the editor
// submits through its own Save Permissions button.
defineExpose({
  finalizePermissions: goToPermissionsStepTwo,
  isFinalizing: loading,
  isOnFirstSubStep: computed(() => selectedStepIndex.value === 0),
});

const poolPerformanceFeeAddress = computed(() => {
  const { rethinkContractAddresses } = useContractAddresses();
  return rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[
    fundChainId.value
  ];
});

const storePermissions = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  console.log("fundInitCacheSettings", fundInitCacheSettings);
  console.log("delegatedPermissionsEntry", delegatedPermissionsEntry.value);
  const fundAddress = fundInitCache?.value?.fundContractAddr;

  if (
    !roleModAddress.value ||
    !fundAddress ||
    !fundInitCacheSettings?.baseToken
  ) {
    console.error("Missing fund init cache data", fundInitCache);
    loading.value = false;
    return toastStore.errorToast(
      "Something went wrong while storing permissions. " +
        "Missing fund init cache data.",
    );
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
    JSON.stringify(proposalData.encodedRoleModEntries, null, 2),
  );

  if (allowManagerToSendFundsToFundContract.value) {
    const _encodedRoleModEntries =
      getAllowManagerToSendFundsToFundContractPermission(
        fundInitCacheSettings?.baseToken,
      );
    proposalData.encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  // Add allowManagerToCollectFees permissions if the switch button is enabled.
  if (allowManagerToCollectFees.value) {
    const _encodedRoleModEntries =
      getAllowManagerToCollectFeesPermission(fundAddress);
    proposalData.encodedRoleModEntries.push(..._encodedRoleModEntries);
  }

  // A switch that is off is revoked rather than skipped — same rule as V2.
  // Prepended so the role editor's own calls, which sit at the head of this
  // batch, keep the last word on anything they touch explicitly.
  const revokedScopesV1: IPermissionScope[] = [];
  if (!allowManagerToSendFundsToFundContract.value) {
    revokedScopesV1.push({
      target: fundInitCacheSettings.baseToken,
      selector: TRANSFER_SELECTOR,
    });
  }
  if (!allowManagerToCollectFees.value) {
    revokedScopesV1.push({
      target: fundAddress,
      selector: FUND_FLOWS_CALL_SELECTOR,
    });
  }
  proposalData.encodedRoleModEntries.unshift(
    ...buildRevokeEntriesV1(
      revokedScopesV1,
      selectedRole.value?.id || DEFAULT_ROLE_KEY,
    ),
  );

  const fundFactoryContract =
    web3Store.chainContracts[fundChainId.value]?.fundFactoryContract;

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
    await fetchPermissions(roleModAddress.value);
    console.log("fetched roles", roles.value);
    // If no roles or permissions exist, pre-populate an empty role with roleId 1
    if (!roles.value?.length) {
      // Pre-populate an empty role with roleId 1
      const roleId = DEFAULT_ROLE_KEY;
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
  display: flex;
  flex-direction: column;
}

/* The title with the Roles version beside it, the way the whitelist step
   tags its title; the blocks under it bring their own top margin. */
.perm_title_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.perm_section_title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: $color-white;
}

.perm_badge {
  padding: 0.25rem 0.5rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-family: $font-mono;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;
}

.perm_role_row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
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
  &__buttons {
    display: flex;
    flex-direction: column;
    gap: 15px;

    @include md {
      flex-direction: row;
    }
  }
}

.info_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3rem;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
