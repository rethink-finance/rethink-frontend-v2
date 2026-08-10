<template>
  <div class="permissions_wrapper">
    <template v-if="selectedStepIndex === 0">
      <!-- The two contracts every permission on this page is written against.
           They exist from the moment the vault was initialized, so they head
           the step rather than sitting in a footnote under it. -->
      <div class="perm_head">
        <div class="perm_head__pairs">
          <div class="perm_head__pair">
            <span class="perm_head__label">Safe contract</span>
            <AddressLink
              v-if="fundSettings?.safe"
              :address="fundSettings.safe"
              :chain-id="fundChainId"
            />
            <span v-else class="perm_head__value">N/A</span>
          </div>
          <div class="perm_head__pair">
            <span class="perm_head__label">Roles modifier</span>
            <AddressLink
              v-if="roleModAddress"
              :address="roleModAddress"
              :chain-id="fundChainId"
            />
            <span v-else class="perm_head__value">N/A</span>
          </div>
        </div>
        <span class="perm_head__badge">
          {{ fundFactoryContractV2Used ? "Roles V2" : "Roles V1" }}
        </span>
      </div>

      <div v-if="!fundFactoryContractV2Used" class="perm_role_row">
        <RoleSelectRole v-model="selectedRole" :roles="roles" />
        <PermissionImportRawPermissions />
      </div>
    </template>

    <FundPermissions
      v-if="selectedStepIndex === 0 && !fundFactoryContractV2Used"
      class="mt-6"
      :chain-id="fundChainId"
      :is-loading="isFetchingPermissions"
      :error-message="updateRoleError"
    />
    <div v-else-if="selectedStepIndex === 0 && fundFactoryContractV2Used">
      <PermissionsManagement
        v-model:allow-manager-to-send-funds-to-fund-contract="
          allowManagerToSendFundsToFundContract
        "
        v-model:allow-manager-to-collect-fees="allowManagerToCollectFees"
        v-model:allow-manager-to-update-nav="allowManagerToUpdateNav"
        v-model:allow-manager-to-update-settings="allowManagerToUpdateSettings"
        v-model:allow-manager-to-manage-role-members="
          allowManagerToManageRoleMembers
        "
        class="mt-6"
        :fund-factory-contract-v2-used="fundFactoryContractV2Used"
      />
      <div
        v-if="allowManagerToUpdateSettings || allowManagerToManageRoleMembers"
        class="activation_notice"
      >
        <strong>Granted — pending activation via governance.</strong>
        <span v-if="allowManagerToUpdateSettings">
          "Update vault settings" stays inert until a one-time governance
          proposal hands settings authority to the Safe (sets the vault's
          governor to the Safe address).
        </span>
        <span v-if="allowManagerToManageRoleMembers">
          "Manage role members" stays inert until a one-time governance
          proposal transfers the Roles modifier's ownership to the Safe.
        </span>
        <span>
          After the vault is finalized, create the activation proposal with
          one click from the vault's Permissions page.
        </span>
      </div>
      <OnboardingRoleMembers
        v-model="pendingRoleMembershipChanges"
        class="mt-4"
      />
    </div>

    <div v-if="selectedStepIndex === 0" class="perm_foot">
      <div class="perm_foot__buttons">
        <UiLinkExternalButton
          title="View vault permissions"
          :href="gnosisPermissionsUrl"
        />
        <OnboardingRawPermissionsCode
          v-if="fundFactoryContractV2Used"
          v-model="rawPermissionCodeEntries"
        />
      </div>
      <p class="perm_foot__text">
        Having trouble reading permissions?
        <a
          class="perm_foot__link"
          href="https://docs.rethink.finance/rethink.finance"
          target="_blank"
          rel="noopener"
        >Learn more about permissions</a>
      </p>
    </div>

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
        <PermissionsManagement
          v-model:allow-manager-to-send-funds-to-fund-contract="
            allowManagerToSendFundsToFundContract
          "
          v-model:allow-manager-to-collect-fees="allowManagerToCollectFees"
          v-model:allow-manager-to-update-nav="allowManagerToUpdateNav"
          v-model:allow-manager-to-update-settings="allowManagerToUpdateSettings"
          v-model:allow-manager-to-manage-role-members="
            allowManagerToManageRoleMembers
          "
          :fund-factory-contract-v2-used="fundFactoryContractV2Used"
        />
      </template>
    </FundGovernanceDelegatedPermissions>
  </div>
</template>

<script setup lang="ts">
import { encodeFunctionCall, encodeParameter } from "web3-eth-abi";
import { padLeft } from "web3-utils";
import { ethers } from "ethers";
import {
  DelegatedPermissionFieldsMap,
  DelegatedPermissionFieldsMapV2,
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
import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
  defaultScopedTargetPermissionRolesV2,
  generateNAVPermissionRolesV2,
  getAssignMembersRoleV2,
  getScopeTargetV2,
  type IAssignMemberChange,
  rolesV2WriteFunctionAbiMap,
} from "~/composables/nav/generateNAVPermission";
import PermissionsManagement from "~/components/onboarding/PermissionsManagement.vue";
import AddressLink from "~/components/common/AddressLink.vue";
import {
  generateManageRoleMembersPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";
import OnboardingRawPermissionsCode from "~/components/onboarding/RawPermissionsCode.vue";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const roleStore = useRoleStore();

const { fundChainId, fundInitCache, fundSettings, fundFactoryContractV2Used } =
  storeToRefs(createFundStore);
const { roles, selectedRole, isFetchingPermissions, fetchPermissions } =
  useRoles(fundChainId.value, fundInitCache?.value?.fundSettings?.fundAddress);

const updateRoleError = ref("");
const selectedStepIndex = ref(0);
const loading = ref(false);
// All three start on: the design presents them as the permissions a vault
// normally needs to run, and a curator who does not want one turns it off here
// rather than discovering later that the manager cannot settle a flow.
const allowManagerToSendFundsToFundContract = ref(true);
const allowManagerToCollectFees = ref(true);
const allowManagerToUpdateNav = ref(true);
// The two below start off: they widen the manager's authority (settings +
// role membership) and need a one-time governance activation anyway, so
// they are strictly opt-in.
const allowManagerToUpdateSettings = ref(false);
const allowManagerToManageRoleMembers = ref(false);
const pendingRoleMembershipChanges = ref<IAssignMemberChange[]>([]);
const rawPermissionCodeEntries = ref<IRawPermissionCodeEntry[]>([]);
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
const delegatedPermissionFieldsMap = computed(() =>
  fundFactoryContractV2Used.value
    ? DelegatedPermissionFieldsMapV2
    : DelegatedPermissionFieldsMap,
);
const roleModAddress = computed(() => fundInitCache?.value?.rolesModifier);
const gnosisPermissionsUrl = computed(() => {
  if (!fundChainId.value) return "";

  return getGnosisPermissionsUrl(
    networksMap[fundChainId.value]?.chainShort || "",
    roleModAddress.value || "",
    fundFactoryContractV2Used.value,
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

  // If roles V2 just finalize permission and submit the transaction.
  if (fundFactoryContractV2Used.value) {
    return storePermissionsV2();
  }

  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(
      fundChainId.value,
    );
    selectedStepIndex.value = 1;
  } catch (e: any) {
    console.error("Failed updating role", e);
    if (e.message === "No role") {
      // No role edits were made; continue with no prepared transactions.
      permissionsProposalStore.rawTransactions = [];
      selectedStepIndex.value = 1;
    } else {
      updateRoleError.value = e.message;
    }
  }
};

// The step's primary action lives in the page's sticky footer, where every
// other step's does; this is what that button calls.
defineExpose({
  finalizePermissions: goToPermissionsStepTwo,
  isFinalizing: loading,
  isOnFirstSubStep: computed(() => selectedStepIndex.value === 0),
});

const navExecutorAddress = computed(() => {
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  return getNAVExecutorBeaconProxyAddress(fundChainId.value);
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

  if (fundFactoryContractV2Used.value) {
    console.error(
      "fundFactoryContractV2Used cannot submit with v1 store permissions",
    );
    return;
  }

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

const storePermissionsV2 = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
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

  loading.value = true;
  console.log("roleModAddress", roleModAddress.value);

  const proposalData = prepPermissionsProposalData(roleModAddress.value, []);
  console.log(
    "storePermissions data:",
    JSON.stringify(proposalData.encodedRoleModEntries, null, 2),
  );

  if (allowManagerToUpdateNav.value) {
    if (!navExecutorAddress.value || !fundAddress) {
      console.error(
        "Missing navExecutorAddress or fundAddress for Roles V2 permission",
        { navExecutorAddress: navExecutorAddress.value, fundAddress },
      );
      loading.value = false;
      return toastStore.errorToast(
        "Could not create Roles V2 permission: missing NAV executor or fund address.",
      );
    }
    const _encodedRoleModEntries = generateNAVPermissionRolesV2(
      fundAddress,
      navExecutorAddress.value,
    );
    proposalData.encodedRoleModEntries.push(..._encodedRoleModEntries);
  }
  if (allowManagerToSendFundsToFundContract.value) {
    proposalData.encodedRoleModEntries.push(
      getScopeTargetV2(DEFAULT_ROLE_KEY_V2, fundInitCacheSettings?.baseToken),
    );

    proposalData.encodedRoleModEntries.push(
      defaultScopedTargetPermissionRolesV2(
        DEFAULT_ROLE_KEY_V2,
        fundInitCacheSettings?.baseToken,
        "0xa9059cbb", // 4-byte function selector of "transfer(address,uint256)"
        fundAddress,
      ),
    );
  }
  if (allowManagerToCollectFees.value) {
    // V2: allow manager to collect fees based on default performance fee contract
    try {
      if (!poolPerformanceFeeAddress.value) {
        throw new Error(
          "Missing PoolPerformanceFeeBeaconProxy address for current chain",
        );
      }

      // Role key used in V2 helpers elsewhere
      const roleKeyBytes = ethers.encodeBytes32String(DEFAULT_ROLE_KEY_V2);

      // Build compValue for Dynamic EqualTo condition:
      // concat(inner selector (mintPoolPerformanceFeeHWM) + abiEncoded(address poolPerformanceFeeAddress))
      const mintPoolPerformanceFeeHWMSelector = "0xa52eb8be";
      const abiEncodedPoolPerformanceFeeAddress = (ethers.AbiCoder as any)
        .defaultAbiCoder()
        .encode(["address"], [poolPerformanceFeeAddress.value]);

      const innerBytes =
        mintPoolPerformanceFeeHWMSelector +
        abiEncodedPoolPerformanceFeeAddress.slice(2);
      const compValue = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes"],
        [innerBytes],
      );

      // Conditions (V2 flat conditions):
      // [parent, paramType, operator, compValue]
      // parent=0 (root), Calldata Matches (to enable calldata parsing),
      // then Dynamic EqualTo with the concatenated bytes
      const conditions: any[] = [
        [0, 5, 5, "0x"], // Calldata + Matches
        [0, 2, 16, compValue], // Dynamic + EqualTo
      ];

      const encodedScopeFunction = encodeFunctionCall(
        rolesV2WriteFunctionAbiMap.scopeFunction,
        [
          roleKeyBytes,
          fundAddress,
          "0xec68ac8d", // functionSig "fundFlowsCall(bytes)"
          conditions,
          0, // ExecutionOptions.None
        ],
      );
      proposalData.encodedRoleModEntries.push(encodedScopeFunction);

      const encodedScopeTarget = encodeFunctionCall(
        rolesV2WriteFunctionAbiMap.scopeTarget,
        [roleKeyBytes, fundAddress],
      );
      proposalData.encodedRoleModEntries.push(encodedScopeTarget);
    } catch (e) {
      console.error("Failed to add allowManagerToCollectFees V2 permission", e);
      toastStore.errorToast("Failed to add V2 fee collection permission");
      loading.value = false;
      return;
    }
  }

  if (allowManagerToUpdateSettings.value) {
    try {
      // Pin to the values the factory will store — the raw init-cache
      // settings struct plus the two fee periods, never derived frontend
      // state. (The init-cache rewrite in fetchFundInitCache only ADDS
      // frontend keys; the raw struct fields used here are untouched.)
      const pinned = parseUpdateSettingsPinnedValues(
        fundInitCacheSettings,
        fundInitCache?.value?._feePerformancePeriod,
        fundInitCache?.value?._feeManagePeriod,
      );
      proposalData.encodedRoleModEntries.push(
        ...generateUpdateSettingsPermissionRolesV2(fundAddress, pinned),
      );
    } catch (e: any) {
      console.error("Failed to add updateSettings V2 permission", e);
      toastStore.errorToast(
        "Failed to add the update-vault-settings permission: " + e.message,
      );
      loading.value = false;
      return;
    }
  }

  if (allowManagerToManageRoleMembers.value) {
    proposalData.encodedRoleModEntries.push(
      ...generateManageRoleMembersPermissionRolesV2(roleModAddress.value),
    );
  }

  // Add/Remove members widget (Roles V2 assignRoles)
  console.log(
    "pendingRoleMembershipChanges.value",
    pendingRoleMembershipChanges.value,
  );
  if (pendingRoleMembershipChanges.value?.length) {
    console.log(
      "proposalData.encodedRoleModEntries members",
      proposalData.encodedRoleModEntries,
    );
    proposalData.encodedRoleModEntries.push(
      ...getAssignMembersRoleV2(
        DEFAULT_ROLE_KEY_V2,
        pendingRoleMembershipChanges.value,
      ),
    );
  }

  // Raw permissions pasted as code — already validated against the Roles V2
  // ABI by the input component; submitted verbatim.
  if (rawPermissionCodeEntries.value.length) {
    proposalData.encodedRoleModEntries.push(
      ...rawPermissionCodeEntries.value.map((entry) => entry.data),
    );
  }
  const fundFactoryContract =
    web3Store.chainContracts[fundChainId.value]?.fundFactoryContractV2;

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
      const roleId = fundFactoryContractV2Used.value
        ? DEFAULT_ROLE_KEY_V2
        : DEFAULT_ROLE_KEY;
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

.perm_head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;

  &__pairs {
    display: flex;
    gap: 3rem;
    flex-wrap: wrap;
  }

  &__pair {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-steel-blue;
  }

  &__badge {
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}

.activation_notice {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.875rem 1.125rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-steel-blue;

  strong {
    color: $color-white;
  }
}

.perm_role_row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.perm_foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;

  &__buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__text {
    margin-left: auto;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__link {
    color: $color-cyan;
    text-decoration: underline;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }
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
