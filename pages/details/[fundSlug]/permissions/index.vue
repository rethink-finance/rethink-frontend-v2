<template>
  <div v-if="appSettingsStore.isManageMode" class="permissions">
    <UiMainCard
      v-if="fund?.fundFactoryContractV2Used"
      class="permissions__content brand_card"
    >
      <div class="v2_head">
        <div class="v2_head__title">
          <span class="brand_card__eyebrow">Roles and permissions</span>
          <span class="v2_head__badge">Roles V2</span>
          <span v-if="isManaging" class="v2_head__mode">Managing</span>
        </div>
        <div class="v2_head__buttons">
          <button
            type="button"
            class="v2_head__refresh"
            :disabled="isReadingScopeLogs"
            @click="refreshScopes"
          >
            {{ isReadingScopeLogs ? "Reading…" : "Refresh" }}
          </button>
          <UiLinkExternalButton
            title="View in Roles app"
            :href="gnosisRolesUrl"
          />
          <v-btn
            v-if="!isManaging"
            color="primary"
            @click="isManaging = true"
          >
            Manage permissions
          </v-btn>
          <v-btn
            v-else
            variant="outlined"
            @click="stopManaging"
          >
            {{ hasPendingChanges ? "Discard changes" : "Done" }}
          </v-btn>
        </div>
      </div>
      <p v-if="isManaging" class="v2_hint">
        Member changes run from your wallet's own role. Removing or adding
        permissions builds one governance proposal, sent from the bar at the
        bottom.
      </p>

      <FundPermissionsActivationLine
        v-for="proposal in activationProposalsInFlight"
        :key="proposal.proposalId"
        class="mt-4"
        :proposal="proposal"
      />

      <div v-if="needsActivation && activationProposalsChecked" class="activation_card mt-6">
        <strong>Role permissions pending activation</strong>
        <p v-if="proposesSettingsAuthority">
          The vault-settings permissions (whitelist, metadata, fee
          destinations) stay inert until governance changes the vault's
          default configuration and hands settings authority to the Safe
          (one-time <code>governor&nbsp;→&nbsp;Safe</code> settings change).
        </p>
        <p v-if="proposesOwnershipTransfer">
          The role-member permissions stay inert until governance
          transfers the Roles modifier's ownership to the Safe.
        </p>
        <p v-if="proposesSettingsAuthority" class="activation_card__hint">
          One proposal covers everything still pending. The whitelist is
          untouched: the proposal echoes current settings with empty
          depositor/manager arrays (those arrays are toggle deltas, not
          absolute lists).
        </p>
        <p v-else class="activation_card__hint">
          The proposal leaves the vault's configuration as it is: no role
          on this vault was granted a vault-settings permission.
        </p>
        <v-btn
          color="primary"
          :loading="isCreatingActivationProposal"
          :disabled="!canCreateProposal"
          @click="createActivationProposal"
        >
          Create activation proposal
          <v-tooltip
            v-if="!canCreateProposal"
            :model-value="true"
            activator="parent"
            location="top"
            @update:model-value="true"
          >
            {{ NO_DELEGATES_TITLE }}
          </v-tooltip>
        </v-btn>

        <FundGovernanceDelegationNotice />
      </div>

      <!-- Each role in turn, the executor first: who holds it, then what it
           may do. Read-only until Manage permissions is pressed. -->
      <FundPermissionsRolesV2Grants
        v-if="roleModAddress"
        v-model:selected-key="selectedRoleKey"
        class="mt-8"
        :chain-id="fund.chainId"
        :fund-address="fund.address"
        :safe-address="fund.safeAddress"
        :roles-mod-address="roleModAddress"
        :base-token="fund.baseToken?.address"
        :logs="scopeLogs"
        :is-loading="isReadingScopeLogs"
        :error="scopeLogsError"
        :pending-activation="pendingActivation"
        :executor-role-key="executorRoleKey"
        :draft-roles="draftRoleViews"
        :manage="isManaging"
        :removals="removals"
        :operation-edits="operationEdits"
        :member-editor-keys="memberEditorKeys"
        :account="connectedAccount"
        @refresh="refreshScopes"
        @remove="markRemoval"
        @toggle-operation="toggleOperation"
        @remove-role="dropCustomRole"
      >
        <template #members="{ role }">
          <OnboardingRoleMembers
            :key="`members:${role.keyBytes}`"
            :ref="(el: any) => setMembersRef(role, el)"
            :model-value="memberChangesOf(role)"
            embedded
            :readonly="!isManaging || (!isCustomRole(role) && !canEditMembers)"
            :role-label="role.name"
            :role-key="memberRoleKey(role)"
            :recommend-multisig="role.kind === 'admin'"
            :chain-id="fund.chainId"
            :roles-mod-address="roleModAddress"
            :empty-text="memberEmptyText(role)"
            :leaves-empty-text="role.kind === 'admin' ? 'These changes leave the vault with no admin. Only governance could assign one afterwards.' : undefined"
            @update:model-value="(changes: IAssignMemberChange[]) => setMemberChanges(role, changes)"
          />
          <p v-if="isManaging && isCustomRole(role)" class="manage_note manage_note--info">
            Members of a custom role are changed by the permissions proposal: the
            admin role may only change executor and admin members.
          </p>
          <p v-else-if="isManaging && !canEditMembers" class="manage_note">
            {{ membersLockedReason }}
          </p>
        </template>

        <template #add-role="{ done }">
          <OnboardingAddRole :add="(name: string) => addRole(name, done)" />
        </template>

        <template #additions="{ role }">
          <div class="additions">
            <div class="additions__title">
              Add permissions to {{ role.name }}
            </div>
            <OnboardingProtocolPermissions
              :key="role.keyBytes"
              :model-value="additionsFor(role).selections"
              :raw-entries="additionsFor(role).raw"
              :chain-id="fund.chainId"
              :roles-mod-address="roleModAddress"
              :safe-address="fund.safeAddress"
              :vault-address="fund.address"
              :base-token="fund.baseToken?.address"
              :context-role="role.label"
              :role-key="role.keyBytes"
              @update:model-value="(selections: IProtocolSelectionState[]) => (additionsFor(role).selections = selections)"
              @update:raw-entries="(raw: IRawPermissionCodeEntry[]) => (additionsFor(role).raw = raw)"
            />
          </div>
        </template>
      </FundPermissionsRolesV2Grants>

      <!-- Everything queued in manage mode, and the two ways it is sent:
           member changes from the wallet, permissions as a proposal. -->
      <div v-if="isManaging" class="pending">
        <div class="pending__group">
          <div class="pending__label">
            Members
          </div>
          <div class="pending__text">
            {{ memberSummary }}
          </div>
          <v-btn
            color="primary"
            variant="outlined"
            :disabled="!queuedMemberChanges.length || !canEditMembers"
            :loading="isExecutingMemberChanges"
            @click="executeMemberChanges"
          >
            Execute member changes
          </v-btn>
        </div>

        <div class="pending__group pending__group--wide">
          <div class="pending__label">
            Permissions
          </div>
          <div class="pending__text">
            {{ permissionSummary }}
            <button
              v-if="removalCount || operationChangeCount"
              type="button"
              class="pending__undo"
              @click="removals = {}; operationEdits = {}"
            >
              Undo changes
            </button>
          </div>
          <p v-for="issue in permissionIssues" :key="issue" class="pending__issue">
            {{ issue }}
          </p>
          <div class="pending__propose">
            <v-text-field
              v-model="proposalTitle"
              class="pending__title"
              density="compact"
              hide-details
              placeholder="Proposal title"
            />
            <v-btn
              color="primary"
              :disabled="!permissionCalls.length || permissionIssues.length > 0 || !canCreateProposal"
              :loading="isProposing"
              @click="createPermissionsProposal"
            >
              Create proposal
              <v-tooltip
                v-if="!canCreateProposal"
                activator="parent"
                location="top"
              >
                {{ NO_DELEGATES_TITLE }}
              </v-tooltip>
            </v-btn>
          </div>
          <button type="button" class="pending__link" @click="navigateToCreatePermissions">
            Or build a proposal call by call
          </button>
        </div>
      </div>
    </UiMainCard>
    <UiMainCard v-else class="permissions__content brand_card">
      <div class="info_container">
        <div class="info_container__buttons">
          <div class="d-flex align-center">
            <div class="d-flex align-center me-6">
              <RoleSelectRole v-model="selectedRole" :roles="roles" />
            </div>
            <PermissionImportRawPermissions :disabled="isEditDisabled" />
          </div>

          <div v-if="appSettingsStore.isManageMode" class="is-manage-mode">
            <v-btn
              v-if="isEditDisabled"
              color="primary"
              @click="isEditDisabled = false"
            >
              Edit
            </v-btn>
            <div v-else>
              <v-btn
                color="primary"
                @click="navigateToCreatePermissions"
              >
                Create Permissions Proposal
              </v-btn>
              <v-btn
                variant="text"
                color="secondary"
                @click="isEditDisabled = true"
              >
                <Icon
                  icon="ic:twotone-cancel"
                  width="1.5rem"
                />
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Permissions loaded from zodiac roles modifier -->
      <!-- TODO here it flickers as we first have to fetch fundData and then roleModAddress, prevent flickering -->
      <FundPermissions
        class="mt-6"
        :chain-id="fund.chainId"
        :disabled="isEditDisabled"
        :is-loading="isLoading"
      />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import { useRoleStore } from "~/store/role/role.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { useRoles } from "~/composables/permissions/useRoles";
import { useToastStore } from "~/store/toasts/toast.store";
import PermissionImportRawPermissions from "~/components/permission/ImportRawPermissions.vue";
import RoleSelectRole from "~/components/role/SelectRole.vue";
import { ActionState } from "~/types/enums/action_state";
import { useActionStateStore } from "~/store/actionState.store";
import UiLinkExternalButton from "~/components/global/ui/LinkExternalButton.vue";
import {
  buildActivationProposalActions,
  fetchActivationState,
  type IActivationState,
} from "~/composables/permissions/activationProposal";
import {
  buildAssignRolesCalldata,
  fetchRoleMembers,
} from "~/composables/permissions/useRoleExecution";
import {
  clearCuratorRoleCache,
  sendCuratorTransaction,
  simulateCuratorTransaction,
} from "~/composables/permissions/useCuratorExecution";
import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_V2,
  resolveExecutorRoleKey,
  toRoleKeyBytes32,
  type IAssignMemberChange,
} from "~/composables/nav/generateNAVPermission";
import { listLiveRoleKeys } from "~/composables/permissions/roleScopeLogs";
import { UPDATE_SETTINGS_SELECTOR } from "~/composables/permissions/rolesV2Permissions";
import {
  fetchRoleScopeLogs,
  reduceRoleScopeLogs,
  type IRoleScopeLog,
} from "~/services/onchain/roleScopes";
import {
  NO_DELEGATES_TITLE,
  useProposalDelegation,
} from "~/composables/governance/useProposalDelegation";
import {
  toProposalCalls,
  useProposalPreflight,
} from "~/composables/governance/useProposalPreflight";
import { RolesVersion } from "~/types/enums/roles_version";
import { useActivationProposals } from "~/composables/permissions/useActivationProposals";
import type IGovernanceProposal from "~/types/governance_proposal";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import {
  buildProtocolPermissionEntries,
  getRegistryProtocols,
  hasEnabledProtocolSelections,
  initProtocolSelections,
  validateProtocolSelections,
  type IProtocolSelectionState,
} from "~/composables/permissions/protocolPermissions";
import {
  buildStoredRoleViews,
  type IStoredRoleView,
} from "~/composables/permissions/storedRoleGrants";
import {
  buildVaultOperationCalls,
  buildRemovalCalls,
  canManageMembers,
  expandRemoval,
  rolesThatManageMembers,
  splitPrepopulated,
  vaultOperationSwitches,
} from "~/composables/permissions/managePermissions";
import { fetchVaultOperationContext } from "~/composables/permissions/vaultOperationContext";
import type { IPrepopulatedPermissionsContext } from "~/composables/permissions/vaultRoles";
import { useVaultCustomRoles } from "~/composables/permissions/useVaultCustomRoles";
import { useRolesChangeProposal } from "~/composables/permissions/useRolesChangeProposal";

const router = useRouter();
const fundStore = useFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const appSettingsStore = useSettingsStore();
const roleStore = useRoleStore();
const toastStore = useToastStore();
const actionStateStore = useActionStateStore();

const { selectedFundSlug } = storeToRefs(useFundStore());
const fund = useAttrs().fund as IFund;
const { canCreateProposal, assertCanCreateProposal } = useProposalDelegation();
const { runPreflight } = useProposalPreflight();

const {
  roles,
  selectedRole,
  isEditDisabled,
  isFetchingPermissions,
  fetchPermissions,
} = useRoles(fund.chainId, fund.address);

const isLoading = computed(() =>
  isFetchingPermissions.value ||
  actionStateStore.isActionState("fetchRoleModAddressAddressAction", ActionState.Loading),
);
const roleModAddress = ref("");

const gnosisRolesUrl = computed(() => {
  if (!fund?.chainShort || !roleModAddress.value) return "";
  return `https://roles.gnosisguild.org/${fund.chainShort}:${roleModAddress.value}`;
});

// One-time governance activation of the roles' vault-settings /
// role-member permissions (Roles V2 vaults only).
const activationState = ref<IActivationState | null>(null);
const isCreatingActivationProposal = ref(false);
// Whether any role was granted a vault-settings permission (updateSettings
// on the vault). null while unknown, which is treated as "yes": the read can
// fail, and a vault whose settings permission is live must not be left
// without the proposal that makes it work.
const settingsPermissionGranted = ref<boolean | null>(null);

/**
 * Moving settings authority to the Safe changes the vault's default
 * configuration, so it is proposed only where a role actually holds a
 * permission that needs it. Role-member permissions need the modifier's
 * ownership alone.
 */
const settingsAuthorityNeeded = computed(
  () =>
    !!activationState.value?.needsGovernorMigration &&
    settingsPermissionGranted.value !== false,
);

// Activation proposals already submitted and still live. Read off the
// governance store (hydrated from cache, refreshed below), so a vault whose
// activation is up for vote is not offered a second, conflicting proposal.
const { proposals: activationProposals, refresh: refreshProposals } = useActivationProposals(() =>
  activationState.value
    ? {
      chainId: fund.chainId,
      fundAddress: fund.address,
      rolesModifier: roleModAddress.value || null,
      safe: activationState.value.safe,
    }
    : null,
);
// The parts of the activation no live proposal covers yet: only these are
// offered, so a partly proposed activation never proposes a step twice.
const proposesSettingsAuthority = computed(
  () => settingsAuthorityNeeded.value && !activationProposals.value.settings,
);
const proposesOwnershipTransfer = computed(
  () =>
    !!activationState.value?.needsOwnershipTransfer &&
    !activationProposals.value.ownership,
);
const activationProposalsInFlight = computed(() => {
  const { ownership, settings } = activationProposals.value;
  const inFlight: IGovernanceProposal[] = [];
  if (activationState.value?.needsOwnershipTransfer && ownership) inFlight.push(ownership);
  if (settingsAuthorityNeeded.value && settings && settings !== ownership) inFlight.push(settings);
  return inFlight;
});
// What the granted-permissions view marks as inert until activation.
const pendingActivation = computed(() => ({
  modifier: !!activationState.value?.needsOwnershipTransfer,
  settings: !!activationState.value?.needsGovernorMigration,
}));
const needsActivation = computed(
  () => proposesSettingsAuthority.value || proposesOwnershipTransfer.value,
);

/**
 * Only while something is left to activate: the full proposal history is a
 * governance-page read, not worth paying for on an activated vault.
 */
// The create card waits for this: shown before the proposals are read, it
// would offer a proposal for a vault whose activation is already up for vote.
const activationProposalsChecked = ref(false);
const refreshActivationProposals = async () => {
  if (
    !activationState.value?.needsOwnershipTransfer &&
    !settingsAuthorityNeeded.value
  ) {
    return;
  }
  await refreshProposals();
  activationProposalsChecked.value = true;
};

const refreshActivationState = async () => {
  if (!fund?.fundFactoryContractV2Used || !fund?.address) return;
  try {
    activationState.value = await fetchActivationState(
      fund.chainId,
      fund.address,
      roleModAddress.value || null,
    );
  } catch (error) {
    console.error("Failed reading activation state", error);
  }
  await refreshActivationProposals();
};

const createActivationProposal = async () => {
  // Guards the click as well as the button: the delegate read can still be in
  // flight when the card renders.
  if (!(await assertCanCreateProposal())) return;

  isCreatingActivationProposal.value = true;
  try {
    const { actions } = await buildActivationProposalActions(
      fund.chainId,
      fund.address,
      roleModAddress.value || null,
      fund.governorAddress,
      {
        settingsAuthority: proposesSettingsAuthority.value,
        ownership: proposesOwnershipTransfer.value,
      },
    );
    if (!actions.targets.length) {
      toastStore.addToast("Nothing left to activate.");
      await refreshActivationState();
      return;
    }
    if (
      !(await runPreflight(
        toProposalCalls(actions.targets, actions.calldatas),
        roleModAddress.value
          ? { address: roleModAddress.value, version: RolesVersion.V2 }
          : undefined,
      ))
    ) {
      return;
    }
    await fundStore.fundGovernorContract
      .send(
        "propose",
        {},
        actions.targets,
        actions.gasValues,
        actions.calldatas,
        JSON.stringify(
          proposesSettingsAuthority.value
            ? {
              title: "Activate vault-settings & role-member permissions",
              description:
                "One-time activation: hand settings authority to the Safe " +
                "(governor = safe, whitelist arrays left empty on purpose, " +
                "they are toggle deltas) and/or transfer Roles modifier " +
                "ownership to the Safe, so the granted Roles V2 " +
                "permissions become executable.",
            }
            : {
              title: "Activate role-member permissions",
              description:
                "One-time activation: transfer the Roles modifier's " +
                "ownership to the Safe, so the granted role-member " +
                "permissions become executable. The vault's settings and " +
                "their authority are not changed.",
            },
        ),
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The activation proposal has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast(
            "Activation proposal created. You can now vote on it in the governance page.",
          );
          refreshActivationProposals();
        } else {
          toastStore.errorToast(
            "The activation proposal transaction failed. Please contact the Rethink Finance support.",
          );
        }
        isCreatingActivationProposal.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        isCreatingActivationProposal.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(error.message);
  } finally {
    isCreatingActivationProposal.value = false;
  }
};

// Role membership (Roles V2): the shared component lists current members
// off the modifier's AssignRoles history and queues the changes; executing
// them goes through the connected wallet's own assignRoles permission (the
// admin role's, or the executor role's on a vault created before the admin
// role existed) — or, on a session connected as the Safe (Zodiac Pilot),
// straight from the Safe that owns the modifier.
const roleMembersRef = ref<{ reload: () => Promise<void> } | null>(null);
const adminMembersRef = ref<{ reload: () => Promise<void> } | null>(null);
const pendingMemberChanges = ref<IAssignMemberChange[]>([]);
const pendingAdminMemberChanges = ref<IAssignMemberChange[]>([]);
const isExecutingMemberChanges = ref(false);

/**
 * Does this vault have the admin role at all? Vaults created before the
 * two-role split carry everything on the executor role, and offering an
 * "admin" list there would hand out a role that permits nothing. The role
 * exists when the modifier stores a scope for it, or when someone holds it.
 */
const hasAdminRole = ref(false);
// Which spelling of the executor's key this vault was created with
// ("defaulManagerRole" or "defaultManagerRole"), read off the same log.
const executorRoleKey = ref(EXECUTOR_ROLE_KEY_V2);

// The modifier's full event log as last read, and which modifier it is for:
// the granted-permissions view folds it, and the checks below answer from it.
const scopeLogs = ref<IRoleScopeLog[] | null>(null);
const scopeLogsModifier = ref("");
const isReadingScopeLogs = ref(false);
const scopeLogsError = ref("");
// The vault's fields land one by one and each re-runs this, so reads
// overlap. A read is applied unless a newer one already was; only the newest
// may report a failure, which then leaves the last applied read on screen.
let scopeLogsRead = 0;
let scopeLogsApplied = 0;

const refreshHasAdminRole = async () => {
  const read = ++scopeLogsRead;
  const modifier = roleModAddress.value;
  // A different modifier starts from scratch; a refresh of the same one keeps
  // what is on screen until the new read lands.
  if (scopeLogsModifier.value !== modifier) {
    hasAdminRole.value = false;
    executorRoleKey.value = EXECUTOR_ROLE_KEY_V2;
    settingsPermissionGranted.value = null;
    scopeLogs.value = null;
    scopeLogsModifier.value = modifier;
    scopeLogsApplied = 0;
  }
  scopeLogsError.value = "";
  if (!fund?.fundFactoryContractV2Used || !modifier) return;
  isReadingScopeLogs.value = true;
  try {
    // One read of the modifier's log answers every question here: whether
    // the admin role is in use, whether either role may change the vault's
    // settings (the admin, or the executor on a vault created before the
    // split), and what each role is granted.
    const logs = await fetchRoleScopeLogs(fund.chainId, modifier);
    if (modifier !== scopeLogsModifier.value || read < scopeLogsApplied) return;
    scopeLogsApplied = read;
    scopeLogsError.value = "";
    scopeLogs.value = logs;
    executorRoleKey.value = resolveExecutorRoleKey(listLiveRoleKeys(logs));
    const admin = reduceRoleScopeLogs(logs, toRoleKeyBytes32(ADMIN_ROLE_KEY_V2));
    const executor = reduceRoleScopeLogs(logs, toRoleKeyBytes32(executorRoleKey.value));
    settingsPermissionGranted.value = [...admin.scopes, ...executor.scopes].some(
      (scope) =>
        scope.target.toLowerCase() === fund.address.toLowerCase() &&
        scope.selector.toLowerCase() === UPDATE_SETTINGS_SELECTOR,
    );
    if (admin.scopes.length || admin.targets.length) {
      hasAdminRole.value = true;
      return;
    }
  } catch (error) {
    if (read !== scopeLogsRead) return;
    console.warn("Could not read the roles' scopes", error);
    scopeLogsError.value =
      "Could not read the Roles modifier's history right now. This is " +
      "usually transient: try Refresh.";
    // The last read that did land stays on screen, and so does what it
    // said about the roles.
    if (scopeLogsApplied > 0) return;
  } finally {
    if (read === scopeLogsRead) isReadingScopeLogs.value = false;
  }
  try {
    const members = await fetchRoleMembers(fund.chainId, modifier, ADMIN_ROLE_KEY_V2);
    if (modifier !== scopeLogsModifier.value || read < scopeLogsApplied) return;
    hasAdminRole.value = members.length > 0;
  } catch (error) {
    console.warn("Could not read the admin role's members", error);
  }
};

// The granted-permissions view's Refresh: its log, and the activation state
// that decides which of its grants are inert.
const refreshScopes = () => Promise.all([refreshActivationState(), refreshHasAdminRole()]);

/**
 * Every queued change with the role it applies to, in the order it has to be
 * sent: additions first, then executor removals, and removals of the admin
 * role last. A transfer of the admin role — add the new admin, remove the
 * old — must assign before it removes, and an admin who is stepping down
 * needs its role for every other change in the queue.
 */
const queuedMemberChanges = computed(() => {
  const rank = (action: IAssignMemberChange["action"], roleKey: string) => {
    if (action === "ADD") return 0;
    return roleKey === ADMIN_ROLE_KEY_V2 ? 2 : 1;
  };
  return [
    ...pendingAdminMemberChanges.value.map((change) => ({
      change,
      roleKey: ADMIN_ROLE_KEY_V2,
      list: pendingAdminMemberChanges,
    })),
    ...pendingMemberChanges.value.map((change) => ({
      change,
      roleKey: executorRoleKey.value,
      list: pendingMemberChanges,
    })),
  ].sort(
    (a, b) =>
      rank(a.change.action, a.roleKey) - rank(b.change.action, b.roleKey),
  );
});

const executeMemberChanges = async () => {
  if (!roleModAddress.value || !queuedMemberChanges.value.length) return;
  isExecutingMemberChanges.value = true;
  try {
    // One execTransactionWithRole per change, sequentially — each is its own
    // wallet signature, and a failure stops the queue so nothing is skipped
    // silently.
    const route = { chainId: fund.chainId, rolesModAddress: roleModAddress.value };
    for (const { change, roleKey, list } of [...queuedMemberChanges.value]) {
      const call = {
        to: roleModAddress.value,
        data: buildAssignRolesCalldata(
          change.address,
          change.action === "ADD",
          roleKey,
        ),
      };
      const simulation = await simulateCuratorTransaction(call, route);
      if (!simulation.ok) {
        toastStore.errorToast(
          simulation.innerRevert
            ? "The modifier rejected this change. Role-member management " +
              "is likely still pending governance activation (see above)."
            : simulation.reason || "The Roles modifier denied this call.",
          10000,
        );
        return;
      }
      await sendCuratorTransaction(call, route).on("transactionHash", () => {
        toastStore.addToast(
          `Membership change for ${change.address} submitted.`,
        );
      });
      // Drop the executed change so a mid-queue failure keeps the rest.
      list.value = list.value.filter((item) => item !== change);
    }
    toastStore.successToast("Role membership updated.");
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(
      error?.message ||
        "There has been an error. Please contact the Rethink Finance support.",
    );
  } finally {
    isExecutingMemberChanges.value = false;
    roleMembersRef.value?.reload();
    adminMembersRef.value?.reload();
    // The granted-permissions view lists members off the same log.
    refreshHasAdminRole();
    // Membership drives the execution buttons on the NAV / settlement /
    // execution pages, so drop what they cached about it.
    clearCuratorRoleCache();
  }
};

/* ---- Manage mode ------------------------------------------------------------
 * Read-only until "Manage permissions" is pressed. Then each role offers its
 * member editor (when the connected wallet may change members), Remove on
 * every stored grant, and the protocol library with raw permissions. Member
 * changes are sent from the wallet; permission changes become one proposal.
 */
const isManaging = ref(false);
const { propose, isProposing } = useRolesChangeProposal();

// The roles as the grants view lists them, for the checks below.
const storedViews = computed((): IStoredRoleView[] => {
  if (!scopeLogs.value) return [];
  try {
    return buildStoredRoleViews(scopeLogs.value);
  } catch {
    return [];
  }
});

// The roles whose members the page lists through the editor: the admin, the
// executor under the key this vault uses, and every custom role.
const memberEditorKeys = computed(() => {
  const executorKey = toRoleKeyBytes32(executorRoleKey.value).toLowerCase();
  return [
    ...storedViews.value
      .filter((view) => view.kind === "admin" || view.keyBytes === executorKey)
      .map((view) => view.keyBytes),
    ...customRoles.value.map((role) => role.keyBytes),
  ];
});

// Custom roles: stored ones read off the modifier, plus names added here.
const { customRoles, addCustomRole, removeCustomRole } = useVaultCustomRoles(
  computed(() => fund?.chainId),
  roleModAddress,
  scopeLogs,
);
const customKeys = computed(() => new Set(customRoles.value.map((role) => role.keyBytes)));
const isCustomRole = (role: IStoredRoleView) => customKeys.value.has(role.keyBytes);
// A named role nothing is stored for yet, shaped like a stored one.
const draftRoleViews = computed((): IStoredRoleView[] =>
  customRoles.value
    .filter((role) => !role.stored)
    .map((role) => ({
      keyBytes: role.keyBytes,
      label: role.roleKey,
      kind: "custom",
      number: role.number,
      name: role.name,
      members: [],
      disabledMembers: [],
      entries: [],
      contracts: 0,
      openContracts: 0,
      emptyTargets: [],
      functions: 0,
      allowances: [],
    })),
);

// The tab on screen; the executor until another one is picked.
const selectedRoleKey = ref("");
const addRole = (name: string, done: (key: string) => void): string => {
  const error = addCustomRole(name);
  if (!error) done(ethers.encodeBytes32String(name.trim()).toLowerCase());
  return error;
};
const dropCustomRole = (role: IStoredRoleView) => {
  const custom = customRoles.value.find((entry) => entry.keyBytes === role.keyBytes);
  if (custom) removeCustomRole(custom);
  delete customMemberChanges[role.keyBytes];
  delete additions[role.keyBytes];
  selectedRoleKey.value = "";
};

// Queued membership changes. The executor's and the admin's are sent from the
// wallet; a custom role's go into the permissions proposal.
const customMemberChanges = reactive<Record<string, IAssignMemberChange[]>>({});
const memberChangesOf = (role: IStoredRoleView): IAssignMemberChange[] => {
  if (role.kind === "admin") return pendingAdminMemberChanges.value;
  if (isCustomRole(role)) return customMemberChanges[role.keyBytes] ?? [];
  return pendingMemberChanges.value;
};
const setMemberChanges = (role: IStoredRoleView, changes: IAssignMemberChange[]) => {
  if (role.kind === "admin") pendingAdminMemberChanges.value = changes;
  else if (isCustomRole(role)) customMemberChanges[role.keyBytes] = changes;
  else pendingMemberChanges.value = changes;
};
const memberRoleKey = (role: IStoredRoleView) => {
  if (role.kind === "admin") return ADMIN_ROLE_KEY_V2;
  if (isCustomRole(role)) return role.label;
  return executorRoleKey.value;
};
const memberEmptyText = (role: IStoredRoleView) => {
  if (role.kind === "admin") {
    return "Nobody holds the admin role. Its permissions stay with governance until someone does.";
  }
  if (isCustomRole(role)) return "Nobody holds this role yet.";
  return undefined;
};
const setMembersRef = (role: IStoredRoleView, el: any) => {
  if (role.kind === "admin") adminMembersRef.value = el;
  else if (!isCustomRole(role)) roleMembersRef.value = el;
};

const connectedAccount = computed(() => fundStore.activeAccountAddress || "");
const canEditMembers = computed(() =>
  canManageMembers(connectedAccount.value, {
    safeAddress: fund?.safeAddress,
    managers: rolesThatManageMembers(storedViews.value, roleModAddress.value),
  }),
);
const membersLockedReason = computed(() =>
  connectedAccount.value
    ? "The connected wallet holds no role that may change members. Connect a member of the admin role, or the vault Safe."
    : "Connect a member of the admin role, or the vault Safe, to change members.",
);

// The vault's own contracts, which the prepopulated grants point at.
const vaultContracts = computed(() => ({
  fundAddress: fund?.address ?? "",
  baseToken: fund?.baseToken?.address ?? "",
  rolesModifier: roleModAddress.value,
}));
/** A role's permissions beyond its prepopulated ones: what Remove indexes into. */
const otherEntriesOf = (view: IStoredRoleView) =>
  splitPrepopulated(view.entries, view.label, vaultContracts.value, executorRoleKey.value).other;

// Other permissions marked for removal, by role key, as indices into
// otherEntriesOf(role).
const removals = ref<Record<string, number[]>>({});
const markRemoval = (role: IStoredRoleView, entries: IRawPermissionCodeEntry[], indices: number[]) => {
  const current = removals.value[role.keyBytes] ?? [];
  removals.value = {
    ...removals.value,
    [role.keyBytes]: expandRemoval(entries, [...current, ...indices]),
  };
};

const removalCount = computed(() =>
  Object.values(removals.value).reduce((sum, list) => sum + list.length, 0),
);

/* Vault operations (the create flow's switches), toggled chip by chip. */

/** A role's operations as the chain has them. */
const operationsOf = (view: IStoredRoleView) =>
  vaultOperationSwitches(
    splitPrepopulated(view.entries, view.label, vaultContracts.value, executorRoleKey.value).grants,
    view.label,
  );

// Desired states, by role key then switch key; only what was clicked.
const operationEdits = ref<Record<string, Record<string, boolean>>>({});
const toggleOperation = (role: IStoredRoleView, key: string) => {
  const stored = operationsOf(role).find((op) => op.key === key);
  if (!stored) return;
  const edits = { ...(operationEdits.value[role.keyBytes] ?? {}) };
  const next = !(edits[key] ?? stored.on);
  if (next === stored.on) delete edits[key];
  else edits[key] = next;
  operationEdits.value = { ...operationEdits.value, [role.keyBytes]: edits };
};
const operationChangeCount = computed(() =>
  Object.values(operationEdits.value).reduce((sum, edits) => sum + Object.keys(edits).length, 0),
);

// What re-issuing a grant needs from the live vault, read once manage mode opens.
const operationContext = ref<IPrepopulatedPermissionsContext | null>(null);
const operationContextError = ref("");
watch(
  () => [isManaging.value, roleModAddress.value, executorRoleKey.value] as const,
  async ([managing, modifier, executorKey]) => {
    if (!managing || !modifier || !fund?.address) return;
    operationContextError.value = "";
    try {
      operationContext.value = await fetchVaultOperationContext({
        chainId: fund.chainId,
        fundAddress: fund.address,
        baseToken: fund.baseToken?.address ?? "",
        rolesModifier: modifier,
        executorRoleKey: executorKey,
      });
    } catch (error: any) {
      console.error("Could not read the vault's settings", error);
      operationContextError.value = "The vault's settings could not be read, so vault operations cannot be changed right now.";
    }
  },
  { immediate: true },
);

// What each role gets added: library selections and pasted raw calls.
interface IRoleAdditions {
  selections: IProtocolSelectionState[];
  raw: IRawPermissionCodeEntry[];
}
const additions = reactive<Record<string, IRoleAdditions>>({});
const freshSelections = (): IProtocolSelectionState[] => {
  try {
    return initProtocolSelections(getRegistryProtocols(fund.chainId));
  } catch {
    return [];
  }
};
watch(
  () => [...storedViews.value, ...draftRoleViews.value],
  (views) => {
    for (const view of views) {
      if (!additions[view.keyBytes]) {
        additions[view.keyBytes] = { selections: freshSelections(), raw: [] };
      }
    }
  },
  { immediate: true },
);
const NO_ADDITIONS: IRoleAdditions = { selections: [], raw: [] };
const additionsFor = (role: IStoredRoleView) => additions[role.keyBytes] ?? NO_ADDITIONS;

/** Every queued permission change as Roles calls: removals first, then grants. */
const permissionChanges = computed(() => {
  const removalCalls: string[] = [];
  const grantCalls: string[] = [];
  const issues: string[] = [];
  const lines: string[] = [];
  const operationCalls: string[] = [];
  for (const view of storedViews.value) {
    const edits = operationEdits.value[view.keyBytes] ?? {};
    if (Object.keys(edits).length) {
      const stored = operationsOf(view);
      const current = Object.fromEntries(stored.map((op) => [op.key, op.on]));
      const desired = { ...current, ...edits };
      for (const op of stored) {
        if (op.key in edits) lines.push(`${view.name}: turn ${edits[op.key] ? "on" : "off"} ${op.label}`);
      }
      if (operationContext.value) {
        try {
          operationCalls.push(...buildVaultOperationCalls(view.label, current, desired, operationContext.value));
        } catch (error: any) {
          issues.push(`${view.name}: ${error?.message ?? String(error)}`);
        }
      } else {
        issues.push(operationContextError.value || "Reading the vault's settings for the vault operation changes…");
      }
    }
    const gone = removals.value[view.keyBytes] ?? [];
    if (!gone.length) continue;
    const other = otherEntriesOf(view);
    removalCalls.push(...buildRemovalCalls(other, gone, view.keyBytes));
    for (const index of gone) lines.push(`${view.name}: remove ${other[index]?.label ?? "a grant"}`);
  }
  // Additions go to stored and newly named roles alike.
  for (const view of [...storedViews.value, ...draftRoleViews.value]) {
    const added = additions[view.keyBytes];
    if (!added) continue;
    if (hasEnabledProtocolSelections(added.selections)) {
      const problems = validateProtocolSelections(fund.chainId, added.selections);
      if (problems.length) {
        issues.push(...problems.map((problem) => `${view.name}: ${problem.message}`));
      } else {
        try {
          const build = buildProtocolPermissionEntries({
            chainId: fund.chainId,
            rolesModAddress: roleModAddress.value,
            selections: added.selections,
            roleKey: view.keyBytes,
          });
          grantCalls.push(...build.entries);
          lines.push(...build.descriptions.map((text) => `${view.name}: ${text}`));
        } catch (error: any) {
          issues.push(`${view.name}: ${error?.message ?? String(error)}`);
        }
      }
    }
    for (const entry of added.raw) {
      grantCalls.push(entry.data);
      lines.push(`${view.name}: ${entry.label}`);
    }
  }
  // A custom role's members, assigned by the proposal (as the Safe once the
  // modifier is activated, by the governor before).
  const memberCalls: string[] = [];
  for (const role of customRoles.value) {
    for (const change of customMemberChanges[role.keyBytes] ?? []) {
      memberCalls.push(buildAssignRolesCalldata(change.address, change.action === "ADD", role.roleKey));
      lines.push(`${role.name}: ${change.action === "ADD" ? "add" : "remove"} member ${change.address}`);
    }
  }
  return {
    calls: [...removalCalls, ...operationCalls, ...grantCalls, ...memberCalls],
    removalCalls,
    operationCalls,
    grantCalls,
    memberCalls,
    issues,
    lines,
  };
});
const permissionCalls = computed(() => permissionChanges.value.calls);
const permissionIssues = computed(() => permissionChanges.value.issues);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const memberSummary = computed(() => {
  const count = queuedMemberChanges.value.length;
  if (count) return `${plural(count, "change")} queued, each signed by your wallet.`;
  return canEditMembers.value
    ? "Nothing queued. Add or remove members under a role above."
    : "Your wallet cannot change members.";
});
const permissionSummary = computed(() => {
  const { grantCalls } = permissionChanges.value;
  if (!permissionCalls.value.length && !operationChangeCount.value) {
    return "Nothing queued. Click a vault operation, press Remove on a contract, or Add protocol under a role.";
  }
  const { memberCalls } = permissionChanges.value;
  const parts: string[] = [];
  if (operationChangeCount.value) parts.push(`changes ${plural(operationChangeCount.value, "vault operation")}`);
  if (removalCount.value) parts.push(`removes ${plural(removalCount.value, "permission")}`);
  if (grantCalls.length) parts.push(`adds ${plural(grantCalls.length, "call")}`);
  if (memberCalls.length) parts.push(`changes ${plural(memberCalls.length, "custom role member")}`);
  return `One proposal that ${parts.join(" and ")} (${plural(permissionCalls.value.length, "Roles call")}).`;
});

const hasPendingChanges = computed(
  () =>
    queuedMemberChanges.value.length > 0 ||
    permissionCalls.value.length > 0 ||
    operationChangeCount.value > 0 ||
    Object.values(additions).some((added) => hasEnabledProtocolSelections(added.selections)),
);

const resetPermissionChanges = () => {
  removals.value = {};
  operationEdits.value = {};
  for (const key of Object.keys(customMemberChanges)) delete customMemberChanges[key];
  for (const key of Object.keys(additions)) {
    additions[key] = { selections: freshSelections(), raw: [] };
  }
};

const stopManaging = () => {
  pendingMemberChanges.value = [];
  pendingAdminMemberChanges.value = [];
  resetPermissionChanges();
  isManaging.value = false;
};

const proposalTitle = ref("Update vault permissions");
const createPermissionsProposal = async () => {
  const { calls, lines } = permissionChanges.value;
  const proposed = await propose(calls, {
    title: proposalTitle.value.trim() || "Update vault permissions",
    description: lines.join("\n"),
  });
  if (proposed) resetPermissionChanges();
};

const fetchRolesAndPermissions = async () => {
  if (!fund?.address) {
    roles.value = [];
    return;
  }

  try {
    roleModAddress.value = await fundStore.fetchRoleModAddress(fund.address);
    // The V1 zodiac subgraph knows nothing about V2 modifiers; on V2 the
    // members component reads membership straight off the chain once it has
    // the address, so there is nothing to fetch here.
    if (!fund?.fundFactoryContractV2Used) {
      await fetchPermissions(roleModAddress.value);
    }
  } catch (error) {
    console.error(error);
    toastStore.errorToast("Failed loading permissions. Please refresh page.");
  }
  await Promise.all([refreshActivationState(), refreshHasAdminRole()]);
};

const navigateToCreatePermissions = async () => {
  // V1 pre-populates the proposal from the subgraph-backed role editor; a V2
  // proposal starts from a clean slate on the delegated-permissions page.
  if (!fund?.fundFactoryContractV2Used) {
    try {
      permissionsProposalStore.rawTransactions = await roleStore.updateRole(fund.chainId);
    } catch (e: any) {
      console.error("Failed updating role", e);
    }
  }

  router.push(
    `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  );
};

watch(
  // fundFactoryContractV2Used arrives async (a separate version fetch after
  // the fund loads), so it must be a dependency here: the immediate run sees
  // it still false and takes the V1 path, and only this re-run flips the V2
  // page onto its on-chain member loading.
  () => [fund?.chainShort, fund?.address, fund?.fundFactoryContractV2Used],
  () => {
    fetchRolesAndPermissions();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.permissions {
  position: relative;

  &__content {
    min-height: 30rem;
  }
}

.v2_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__mode {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-warning;
  }

  &__refresh {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.5rem 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    transition: color $default-transition-time, border-color $default-transition-time;

    &:hover:not(:disabled) {
      color: $color-white;
      border-color: $color-accent-line;
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  &__badge {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.3125rem 0.625rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    color: $color-cyan;
    background: $color-accent-soft;
  }

  &__buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
}

.v2_hint {
  margin-top: 0.75rem;
  max-width: 62ch;
  font-size: 12.5px;
  line-height: 1.55;
  color: $color-steel-blue;
}

.manage_note {
  margin: 0.5rem 0 0;
  font-size: 12.5px;
  color: $color-warning;

  &--info {
    color: $color-steel-blue;
  }
}

/* Manage mode: what gets added to one role. */
.additions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 1rem;
  border: 1px dashed $color-line-2;
  border-radius: $default-border-radius;

  &__title {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}

/* Manage mode: everything queued, and the two ways it is sent. */
.pending {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) minmax(0, 2fr);
  gap: 1rem 2rem;
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  border: 1px solid $color-accent-line;
  border-radius: $default-border-radius;
  background: $color-surface;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }

  &__group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__text {
    font-size: 13px;
    line-height: 1.5;
    color: $color-white;
  }

  &__undo,
  &__link {
    padding: 0;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
    text-decoration: underline;

    &:hover {
      color: $color-white;
    }
  }

  &__undo {
    margin-left: 0.5rem;
  }

  &__issue {
    margin: 0;
    font-size: 12.5px;
    color: $color-warning;
  }

  &__propose {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  &__title {
    flex: 1;
    min-width: 0;
  }
}

.activation_card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  max-width: 44rem;
  padding: 1rem 1.25rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-size: 13px;
  line-height: 1.5;
  color: $color-steel-blue;

  strong {
    color: $color-white;
  }

  &__hint {
    font-size: 12px;
  }
}
.info_container {
  display: flex;
  flex-direction: column;
  gap: 1rem;

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
    justify-content: space-between;
    gap: 1rem;

    @include md {
      flex-direction: row;
    }
  }
}
</style>
