<template>
  <div class="permissions_wrapper">
    <template v-if="selectedStepIndex === 0">
      <div class="perm_title_row">
        <h2 class="perm_section_title">
          Permissions
        </h2>
        <span class="perm_badge">
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
      <OnboardingRoleMembers
        v-model="pendingRoleMembershipChanges"
        class="mt-6"
        :chain-id="fundChainId"
        :roles-mod-address="roleModAddress"
      />
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
        class="mt-4"
        :fund-factory-contract-v2-used="fundFactoryContractV2Used"
      />
      <OnboardingProtocolPermissions
        v-model="protocolSelections"
        v-model:raw-entries="rawPermissionCodeEntries"
        class="mt-4"
        :chain-id="fundChainId"
        :roles-mod-address="roleModAddress"
        :safe-address="fundSettings?.safe"
      />
    </div>

    <div v-if="selectedStepIndex === 0" class="perm_foot">
      <div class="perm_foot__buttons">
        <UiLinkExternalButton
          title="View vault permissions"
          :href="gnosisPermissionsUrl"
        />

        <!-- The two contracts every permission on this page is written
             against, beside the link that opens them: reference for whoever
             needs an address, not a headline for the step. Each is shown
             truncated with the full address as its tooltip, and copied
             whole by the glyph beside it. -->
        <div class="perm_foot__contracts">
          <div
            v-for="contract in footContracts"
            :key="contract.key"
            class="perm_foot__pair"
          >
            <span class="perm_foot__label">{{ contract.label }}</span>
            <template v-if="contract.address">
              <span class="perm_foot__address" :title="contract.address">
                {{ truncateAddressEllipsis(contract.address) }}
              </span>
              <button
                type="button"
                class="perm_foot__copy"
                :class="{ 'perm_foot__copy--done': copiedAddress === contract.address }"
                :title="copiedAddress === contract.address ? 'Copied' : `Copy the ${contract.label} address`"
                :aria-label="copiedAddress === contract.address ? 'Copied' : `Copy the ${contract.label} address`"
                @click="copyAddress(contract.address)"
              >
                <Icon
                  :icon="copiedAddress === contract.address ? 'material-symbols:check-rounded' : 'clarity:copy-line'"
                  width="0.8125rem"
                  height="0.8125rem"
                />
              </button>
            </template>
            <span v-else class="perm_foot__value">N/A</span>
          </div>
        </div>
      </div>
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
import { truncateAddressEllipsis } from "~/composables/addressUtils";
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
import {
  ASSIGN_ROLES_SELECTOR,
  EXECUTE_NAV_UPDATE_SELECTOR,
  FUND_FLOWS_CALL_SELECTOR,
  TRANSFER_SELECTOR,
  UPDATE_SETTINGS_SELECTOR,
  generateManageRoleMembersPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";
import {
  buildRevokeEntriesV1,
  buildRevokeEntriesV2,
  decodeRolesV2Targets,
  type IPermissionScope,
} from "~/composables/permissions/revokePermissions";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import OnboardingProtocolPermissions from "~/components/onboarding/ProtocolPermissions.vue";
import {
  type IProtocolSelectionState,
  buildProtocolPermissionEntries,
  listProtocolScopesToRevoke,
  validateProtocolSelections,
} from "~/composables/permissions/protocolPermissions";
import {
  fetchCurrentRoleScopes,
  recordPermissionsSaveBlock,
} from "~/services/onchain/roleScopes";
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
// Every prepopulated permission starts on: they are what a vault normally
// needs to run, and a curator who does not want one turns it off here rather
// than discovering later that the manager cannot settle a flow. The last two
// are Roles V2 only and stay inert until the one-time governance activation
// offered from the vault's Permissions page after finalizing.
const allowManagerToSendFundsToFundContract = ref(true);
const allowManagerToCollectFees = ref(true);
const allowManagerToUpdateNav = ref(true);
const allowManagerToUpdateSettings = ref(true);
const allowManagerToManageRoleMembers = ref(true);
const pendingRoleMembershipChanges = ref<IAssignMemberChange[]>([]);
// Raw calldata pasted on the Protocol integrations card (Roles V2 only),
// submitted verbatim at the end of the batch.
const rawPermissionCodeEntries = ref<IRawPermissionCodeEntry[]>([]);
// Protocol grants from the permissions registry (Roles V2 only). The card
// component keeps this in step with what the registry offers on this chain.
const protocolSelections = ref<IProtocolSelectionState[]>([]);
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
    // Everything the save does before .send() — the role-state read, the
    // registry build, the encoders — used to run outside any handler, so a
    // throw was an unhandled rejection: no toast, no transaction, and the
    // button spinning forever.
    try {
      return await storePermissionsV2();
    } catch (error: any) {
      console.error("Failed storing permissions", error);
      loading.value = false;
      toastStore.errorToast(
        error?.message ?? "Storing permissions failed before submission.",
      );
      return;
    }
  }

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

  // Protocol grants first: invalid selections (an enabled protocol with no
  // assets picked) block the save before anything is encoded, and the
  // registry's typed errors abort it the same way.
  const protocolIssues = validateProtocolSelections(
    fundChainId.value,
    protocolSelections.value,
  );
  if (protocolIssues.length) {
    loading.value = false;
    return toastStore.errorToast(protocolIssues[0].message);
  }
  let protocolBuild;
  try {
    protocolBuild = buildProtocolPermissionEntries({
      chainId: fundChainId.value,
      rolesModAddress: roleModAddress.value,
      selections: protocolSelections.value,
    });
  } catch (e: any) {
    console.error("Failed to build protocol permissions", e);
    loading.value = false;
    return toastStore.errorToast(
      "Failed to build protocol permissions: " + e.message,
    );
  }

  loading.value = true;
  console.log("roleModAddress", roleModAddress.value);

  // Captured after the guard above so the receipt closure below keeps the
  // narrowed type.
  const rolesModifierAddress = roleModAddress.value;

  // What the modifier grants right now, replayed from its own event log —
  // the diff below revokes only stale grants on registry-owned addresses
  // instead of sweeping the whole grantable universe (which grew with the
  // catalog until a save approached the block gas limit). Throws when no
  // source is fresh; the caller's catch surfaces it and the save is
  // aborted — a stale read would under-revoke silently.
  const currentRoleScopes = await fetchCurrentRoleScopes(
    fundChainId.value,
    rolesModifierAddress,
    ethers.encodeBytes32String(DEFAULT_ROLE_KEY_V2),
  );

  const proposalData = prepPermissionsProposalData(roleModAddress.value, []);
  console.log(
    "storePermissions data:",
    JSON.stringify(proposalData.encodedRoleModEntries, null, 2),
  );

  // Saving makes the modifier match these switches, in both directions: a
  // permission that is off is revoked, not merely left out. Skipping this
  // would silently keep whatever an earlier save already granted.
  // Revocations go in first so an explicit grant later in the same batch
  // (pasted raw code) still wins over a switch.
  const prepopulatedScopes: Record<string, IPermissionScope> = {
    sendFunds: {
      target: fundInitCacheSettings.baseToken,
      selector: TRANSFER_SELECTOR,
    },
    collectFees: { target: fundAddress, selector: FUND_FLOWS_CALL_SELECTOR },
    updateNav: { target: fundAddress, selector: EXECUTE_NAV_UPDATE_SELECTOR },
    updateSettings: { target: fundAddress, selector: UPDATE_SETTINGS_SELECTOR },
    manageRoleMembers: {
      target: roleModAddress.value,
      selector: ASSIGN_ROLES_SELECTOR,
    },
  };
  const isPrepopulatedEnabled: Record<string, boolean> = {
    sendFunds: allowManagerToSendFundsToFundContract.value,
    collectFees: allowManagerToCollectFees.value,
    updateNav: allowManagerToUpdateNav.value,
    updateSettings: allowManagerToUpdateSettings.value,
    manageRoleMembers: allowManagerToManageRoleMembers.value,
  };
  proposalData.encodedRoleModEntries.push(
    ...buildRevokeEntriesV2(
      [
        ...Object.keys(prepopulatedScopes)
          .filter((key) => !isPrepopulatedEnabled[key])
          .map((key) => prepopulatedScopes[key]),
        // Same authoritative rule for protocol grants — an asset unticked
        // since an earlier save is taken back off the modifier — but diffed
        // against the modifier's actual state, so the revoke set scales
        // with what the vault granted, not with the catalog. The toggles'
        // five scopes are spared in both directions: the base token is
        // usually also a lending reserve, and their own on/off logic above
        // owns those grants.
        ...listProtocolScopesToRevoke(
          fundChainId.value,
          protocolBuild,
          currentRoleScopes,
          Object.values(prepopulatedScopes),
        ),
      ],
      [
        ...Object.keys(prepopulatedScopes)
          .filter((key) => isPrepopulatedEnabled[key])
          .map((key) => prepopulatedScopes[key].target),
        ...decodeRolesV2Targets(
          rawPermissionCodeEntries.value.map((entry) => entry.data),
        ),
        ...protocolBuild.targetAddresses,
      ],
    ),
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
        TRANSFER_SELECTOR, // "transfer(address,uint256)"
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
          FUND_FLOWS_CALL_SELECTOR, // "fundFlowsCall(bytes)"
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

  // Protocol grants compiled by the permissions registry, appended before
  // the raw pasted entries so a power user's explicit calls keep the last
  // word on anything both touch.
  if (protocolBuild.entries.length) {
    console.log(
      `protocol permissions (registry v${protocolBuild.packageVersion})`,
      protocolBuild.selections,
      protocolBuild.descriptions,
    );
    proposalData.encodedRoleModEntries.push(...protocolBuild.entries);
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
          // The freshness floor for the next save's role-state read: a log
          // source that has not indexed this block yet is stale by proof.
          recordPermissionsSaveBlock(
            fundChainId.value,
            rolesModifierAddress,
            Number(receipt.blockNumber),
          );
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

/**
 * The footer's contract pairs: label, and the address once the vault has
 * one. The Safe and the modifier exist from initialization on.
 */
const footContracts = computed(() => [
  { key: "safe", label: "Safe contract", address: unref(fundSettings)?.safe || "" },
  { key: "roles", label: "Roles modifier", address: unref(roleModAddress) || "" },
]);

/** Which footer address was just copied, for its check mark. */
const copiedAddress = ref("");
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const copyAddress = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address);
  } catch {
    toastStore.errorToast("Could not copy the address.");
    return;
  }
  copiedAddress.value = address;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedAddress.value = "";
  }, 1500);
};

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
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
    gap: 0.75rem 1.25rem;
    flex-wrap: wrap;
  }

  /* Two label-and-address pairs in one quiet mono line: the same small caps
     as a field label, the address truncated, both a step dimmer than the
     button they sit beside. */
  &__contracts {
    display: flex;
    align-items: center;
    gap: 0.5rem 1.25rem;
    flex-wrap: wrap;
  }

  &__pair {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__address {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-text-irrelevant;
  }

  /* The copy control: a glyph the size of the text beside it, and a check
     mark for a moment once the address is on the clipboard. */
  &__copy {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }

    &--done {
      color: $color-cyan;
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
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
