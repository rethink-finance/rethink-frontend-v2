<template>
  <!-- A legacy Roles V1 vault has one role and its own editor. -->
  <OnboardingPermissionsLegacy v-if="!fundFactoryContractV2Used" ref="legacyRef" />

  <div v-else class="perm_step">
    <div class="perm_step__title_row">
      <h2 class="perm_step__title">
        Permissions
      </h2>
      <span class="perm_step__badge">Roles V2</span>
    </div>
    <p class="perm_step__lead">
      Pick a role to set who holds it and what it may do. Storing saves every
      role in one transaction.
    </p>

    <!-- One role on screen at a time: the tabs are the whole map of the
         vault's roles, and the way to another one. -->
    <div class="perm_step__tabs" role="tablist" aria-label="Vault roles">
      <button
        v-for="role in stepRoles"
        :key="role.key"
        type="button"
        role="tab"
        class="perm_step__tab"
        :class="{
          'perm_step__tab--active': !isAddingRole && role.key === selectedRole.key,
          'perm_step__tab--off': role.key === ADMIN_KEY && !rolePermissions.adminEnabled,
        }"
        :aria-selected="!isAddingRole && role.key === selectedRole.key"
        @click="selectRole(role.key)"
      >
        <span class="perm_step__tab_number">Role {{ role.number }}</span>
        <span class="perm_step__tab_name">{{ role.name }}</span>
        <span
          v-if="role.key === ADMIN_KEY && !rolePermissions.adminEnabled"
          class="perm_step__tab_state"
        >off</span>
      </button>
      <button
        type="button"
        class="perm_step__tab perm_step__tab--add"
        :class="{ 'perm_step__tab--active': isAddingRole }"
        :aria-expanded="isAddingRole"
        @click="isAddingRole = !isAddingRole"
      >
        <Icon icon="material-symbols:add-rounded" width="1rem" height="1rem" />
        <span class="perm_step__tab_name">Add role</span>
      </button>
    </div>

    <OnboardingAddRole v-if="isAddingRole" class="perm_step__panel" :add="addRole" />

    <template v-else>
      <!-- Who holds the role, and the switches the vault's own contracts
           answer to. Keyed by role, and by save, so the member list is read
           again once a save has changed it. -->
      <OnboardingRoleCard
        :key="`${selectedRole.key}:${savedCount}`"
        class="perm_step__panel"
        hide-number
        :role="selectedRole.definition"
        :members="pendingMembers[selectedRole.key] ?? []"
        :permissions="selectedSwitches"
        :chain-id="fundChainId"
        :roles-mod-address="roleModAddress"
        :optional="isAdminSelected"
        :enabled="!isAdminSelected || rolePermissions.adminEnabled"
        :recommend-multisig="isAdminSelected"
        :removable="selectedRole.removable"
        :disabled-text="ADMIN_OFF_TEXT"
        :custom-toggle="isAdminSelected"
        :custom-enabled="adminCustomEnabled"
        :empty-text="selectedRole.emptyText"
        :leaves-empty-text="selectedRole.leavesEmptyText"
        @update:members="setMembers"
        @update:permissions="setSwitches"
        @update:enabled="(value: boolean) => (rolePermissions.adminEnabled = value)"
        @update:custom-enabled="setAdminCustom"
        @remove="dropSelectedRole"
      />

      <template v-if="showsProtocols">
        <!-- What the vault's modifier already stores for the role beyond its
             switches, read off the chain. Absent until there is something. -->
        <OnboardingRawPermissionsQueue
          v-if="savedEntries.length"
          class="perm_step__saved"
          title="Saved on the vault"
          action-label="Remove"
          collapsible
          :entries="savedEntries"
          :notes="savedNotes"
          :locked="savedLocked"
          :context-role="selectedRole.label"
          :chain-id="fundChainId"
          :vault-address="fundInitCache?.fundContractAddr"
          :safe-address="fundSettings?.safe"
          :roles-mod-address="roleModAddress"
          :base-token="fundSettings?.baseToken"
          @discard="removeSaved"
        >
          <template #head-action>
            <button
              type="button"
              class="perm_step__refresh"
              :disabled="isLoadingSaved"
              @click="loadSaved"
            >
              {{ isLoadingSaved ? "Reading…" : "Refresh" }}
            </button>
          </template>
        </OnboardingRawPermissionsQueue>
        <div v-else-if="savedError" class="perm_step__saved perm_step__saved_empty">
          <span class="perm_step__saved_error">{{ savedError }}</span>
          <button type="button" class="perm_step__refresh" @click="loadSaved">
            Retry
          </button>
        </div>

        <!-- Keyed by role: each one has its own selections, and the card's
             own state (what is open, the order things were added in) must
             not carry over from one role to the next. -->
        <OnboardingProtocolPermissions
          :key="selectedRole.key"
          v-model="protocolSelections"
          v-model:raw-entries="rawPermissionCodeEntries"
          class="perm_step__protocols"
          :chain-id="fundChainId"
          :roles-mod-address="roleModAddress"
          :safe-address="fundSettings?.safe"
          :vault-address="fundInitCache?.fundContractAddr"
          :base-token="fundSettings?.baseToken"
          :context-role="selectedRole.label"
        />
      </template>
    </template>

    <OnboardingVaultContractsFoot
      :chain-id="fundChainId"
      :safe-address="fundSettings?.safe"
      :roles-mod-address="roleModAddress"
      roles-v2
    />
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { prepPermissionsProposalData } from "~/types/enums/delegated_permission";
import { useToastStore } from "~/store/toasts/toast.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  ADMIN_ROLE_KEY_V2,
  getAssignMembersRoleV2,
  type IAssignMemberChange,
  resolveExecutorRoleKey,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import {
  type IRoleBatchOptions,
  buildPermissionsPageBatch,
  integrationScopesToRevoke,
} from "~/composables/permissions/integrationsBatch";
import {
  type IRawPermissionCodeEntry,
  parseRawPermissionCode,
} from "~/composables/permissions/parseRawPermissionCode";
import {
  type IProtocolSelectionState,
  buildProtocolPermissionEntries,
  validateProtocolSelections,
} from "~/composables/permissions/protocolPermissions";
import { describeQueuedCalls } from "~/composables/permissions/rawPermissionQueue";
import {
  type IRoleScopeLog,
  listLiveRoleKeys,
  reduceRoleScopeLogs,
  storedRolePermissionCalls,
} from "~/composables/permissions/roleScopeLogs";
import { fetchRoleMembers } from "~/composables/permissions/useRoleExecution";
import { useVaultCustomRoles } from "~/composables/permissions/useVaultCustomRoles";
import {
  type IVaultRoleDefinition,
  VAULT_ROLES,
  buildPrepopulatedPermissionsBatch,
  customRoleDefinition,
  defaultVaultRolePermissions,
  executorRoleDefinition,
  prepopulatedScopeLabels,
} from "~/composables/permissions/vaultRoles";
import { useContractAddresses } from "~/composables/useContractAddresses";
import { formatRoleKey } from "~/composables/proposal/describeProposalActions";
import {
  fetchRoleScopeLogs,
  recordPermissionsSaveBlock,
} from "~/services/onchain/roleScopes";

/**
 * The create flow's Permissions step: the vault's roles, one on screen at a
 * time. For each: who holds it, the switches for what the vault's own
 * contracts let it do (its prepopulated permissions), and what it may touch
 * beyond them (protocol integrations compiled by the permissions registry,
 * and raw permissions pasted as code) next to what the modifier already
 * stores. Storing sends everything, for every role, in one transaction.
 */
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();

const { fundChainId, fundInitCache, fundSettings, fundFactoryContractV2Used } =
  storeToRefs(createFundStore);

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);
const ADMIN_KEY = toRoleKeyBytes32(ADMIN_ROLE_KEY_V2).toLowerCase();

const ADMIN_OFF_TEXT =
  "The vault runs without an admin. Its profile, whitelist, executor rotation and fee destinations can only be changed through governance.";

// A Roles V1 vault's step is a component of its own; the footer's button is
// handed through to it.
const legacyRef = ref<any>(null);

const loading = ref(false);
// Raw calldata pasted on the card, submitted verbatim at the end of the
// batch. Every raw call names its own role, so there is one queue for the
// step rather than one per role. Removing something saved queues its revoke
// calls here too.
const rawPermissionCodeEntries = ref<IRawPermissionCodeEntry[]>([]);

const roleModAddress = computed(() => fundInitCache?.value?.rolesModifier);

/* ---- What is already stored --------------------------------------------- */

// The modifier's own permission log; null until a read has succeeded.
const savedLogs = ref<IRoleScopeLog[] | null>(null);
const isLoadingSaved = ref(false);
const savedError = ref("");

const loadSaved = async () => {
  if (!fundFactoryContractV2Used.value || !roleModAddress.value) return;
  isLoadingSaved.value = true;
  savedError.value = "";
  try {
    savedLogs.value = await fetchRoleScopeLogs(
      fundChainId.value,
      roleModAddress.value,
    );
  } catch (error) {
    console.error("Failed reading the stored permissions", error);
    savedError.value = "Could not read what the vault stores right now.";
  } finally {
    isLoadingSaved.value = false;
  }
};

watch(
  () => [fundChainId.value, roleModAddress.value, fundFactoryContractV2Used.value],
  () => loadSaved(),
  { immediate: true },
);

/* ---- The roles ----------------------------------------------------------- */

interface IStepRole {
  /** The bytes32 key, lowercase: what everything here is keyed by. */
  key: string;
  /** The key as the generators take it: its label, or the hex. */
  roleKey: string;
  /** The key as a decoded raw call prints it. */
  label: string;
  name: string;
  number: number;
  /** What the role's card shows: its name, tagline and switches. */
  definition: IVaultRoleDefinition;
  /** Added on this page and not stored yet: can be taken off again. */
  removable?: boolean;
  emptyText?: string;
  leavesEmptyText?: string;
}

const { customRoles, addCustomRole, removeCustomRole } = useVaultCustomRoles(
  fundChainId,
  roleModAddress,
  savedLogs,
);

const builtInRole = (definition: IVaultRoleDefinition, key: string): IStepRole => ({
  key,
  roleKey: definition.roleKey,
  label: definition.roleKey,
  name: definition.name,
  number: definition.number,
  definition,
});
const adminRole: IStepRole = {
  ...builtInRole(VAULT_ROLES.admin, ADMIN_KEY),
  emptyText:
    "No admin yet. Add the address that should hold this role. A multisig is recommended. Until then its permissions stay with governance.",
  leavesEmptyText:
    "These changes leave the vault with no admin. Its permissions would stay with governance.",
};
// The executor is whichever spelling of its key the factory gave this vault
// ("defaulManagerRole" or "defaultManagerRole"), read off the modifier's log.
const executorRoleKey = computed(() =>
  resolveExecutorRoleKey(savedLogs.value ? listLiveRoleKeys(savedLogs.value) : []),
);
const executorKey = computed(() => toRoleKeyBytes32(executorRoleKey.value).toLowerCase());
const executorRole = computed(() =>
  builtInRole(executorRoleDefinition(executorRoleKey.value), executorKey.value),
);

/** Admin, executor, then the custom roles: stored, or only named so far. */
const stepRoles = computed<IStepRole[]>(() => [
  adminRole,
  executorRole.value,
  ...customRoles.value.map((role) => ({
    key: role.keyBytes,
    roleKey: role.roleKey,
    label: formatRoleKey(role.keyBytes),
    name: role.name,
    number: role.number,
    definition: customRoleDefinition(role.roleKey, role.name, role.number),
    removable: !role.stored,
    emptyText: "Nobody holds this role yet. Add the addresses that should.",
    leavesEmptyText: "These changes leave the role with no members.",
  })),
]);

const selectedKey = ref(ADMIN_KEY);
const selectedRole = computed(
  () => stepRoles.value.find((role) => role.key === selectedKey.value) ?? executorRole.value,
);
const isAdminSelected = computed(() => selectedRole.value.key === ADMIN_KEY);

const isAddingRole = ref(false);
const selectRole = (key: string) => {
  selectedKey.value = key;
  isAddingRole.value = false;
};

/** Adds a custom role and opens it; returns why it could not be added, or "". */
const addRole = (name: string): string => {
  const error = addCustomRole(name);
  if (!error) selectRole(ethers.encodeBytes32String(name.trim()).toLowerCase());
  return error;
};

/* ---- Who holds each role, and its switches -------------------------------- */

// Queued membership changes, by role key. The executor's list is the one the
// factory seeds with the creating wallet; every other role starts empty.
const pendingMembers = ref<Record<string, IAssignMemberChange[]>>({});
const setMembers = (value: IAssignMemberChange[]) => {
  pendingMembers.value = { ...pendingMembers.value, [selectedRole.value.key]: value };
};

const dropSelectedRole = () => {
  const role = customRoles.value.find((custom) => custom.keyBytes === selectedRole.value.key);
  if (!role) return;
  const without = (record: Record<string, any>) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== role.keyBytes));
  pendingMembers.value = without(pendingMembers.value);
  drafts.value = without(drafts.value);
  removeCustomRole(role);
  selectRole(executorKey.value);
};

// The switches of the two built-in roles. Whatever changes settings or
// membership stays inert until the one-time governance activation offered
// from the vault's Permissions page after finalizing.
const rolePermissions = ref(defaultVaultRolePermissions());

/** The selected role's switches; a custom role has none. */
const selectedSwitches = computed<Record<string, boolean>>(() => {
  if (selectedRole.value.key === ADMIN_KEY) return { ...rolePermissions.value.admin };
  if (selectedRole.value.key === executorKey.value) return { ...rolePermissions.value.executor };
  return {};
});
const setSwitches = (value: Record<string, boolean>) => {
  if (selectedRole.value.key === ADMIN_KEY) {
    rolePermissions.value.admin = value as typeof rolePermissions.value.admin;
  } else if (selectedRole.value.key === executorKey.value) {
    rolePermissions.value.executor = value as typeof rolePermissions.value.executor;
  }
};

/* ---- What each role is about to be granted -------------------------------- */

interface IRoleDraft {
  /** Protocol grants from the permissions registry, as picked on the card. */
  selections: IProtocolSelectionState[];
  /**
   * The protocols the card has been asked about since the page opened: on it
   * now, or added and removed again. A save takes stale grants back only for
   * these; what an earlier visit saved for anything else stays until it is
   * removed here by hand.
   */
  touched: string[];
}

const drafts = ref<Record<string, IRoleDraft>>({});
const NO_SELECTIONS: IProtocolSelectionState[] = [];

/**
 * The selected role's protocol selections. The card component keeps them in
 * step with what the registry offers on this chain.
 */
const protocolSelections = computed<IProtocolSelectionState[]>({
  get: () => drafts.value[selectedKey.value]?.selections ?? NO_SELECTIONS,
  set: (selections) => {
    const touched = [...(drafts.value[selectedKey.value]?.touched ?? [])];
    for (const entry of selections) {
      if (entry.enabled && !touched.includes(entry.protocol)) touched.push(entry.protocol);
    }
    drafts.value = { ...drafts.value, [selectedKey.value]: { selections, touched } };
  },
});

const hasChanges = (draft?: IRoleDraft) =>
  !!draft && (draft.touched.length > 0 || draft.selections.some((entry) => entry.enabled));

/**
 * The admin runs the vault around the strategy and holds no power over its
 * funds, so its page stops at the switches unless "Custom permissions" is
 * switched on. It starts off, and on by itself only for a vault that
 * already stores custom permissions for the admin, so they can be seen and
 * removed. Off, the admin's protocol selections are left out of the save.
 */
const adminCustomEnabled = ref(false);
const isAdminCustomTouched = ref(false);
const setAdminCustom = (value: boolean) => {
  isAdminCustomTouched.value = true;
  adminCustomEnabled.value = value;
};
const showsProtocols = computed(
  () =>
    !isAdminSelected.value ||
    (rolePermissions.value.adminEnabled && adminCustomEnabled.value),
);

/* ---- The selected role's stored permissions ------------------------------- */

const scopeKey = (target?: string, selector?: string) =>
  `${(target ?? "").toLowerCase()}:${(selector ?? "").toLowerCase()}`;
const FUNCTION_GRANTS = ["allow-function", "scope-function"];
const TARGET_GRANTS = ["scope-target", "allow-target"];

const scopeContext = computed(() => ({
  fundAddress: fundInitCache?.value?.fundContractAddr ?? "",
  baseToken: fundInitCache?.value?.fundSettings?.baseToken ?? "",
  rolesModifier: roleModAddress.value ?? "",
}));

/** Everything the modifier stores for the role, as the calls that grant it. */
const storedEntries = computed<IRawPermissionCodeEntry[]>(() => {
  if (!savedLogs.value) return [];
  const calls = storedRolePermissionCalls(savedLogs.value, selectedRole.value.key);
  return calls.length ? parseRawPermissionCode(JSON.stringify(calls)) : [];
});

/**
 * The stored calls that are not the switches' own. A switch is the whole
 * story of its grant, so listing the grant again would say everything twice.
 * A contract's opening call goes with the switches when every function on it
 * does.
 */
const storedSplit = computed(() => {
  const calls = describeQueuedCalls(storedEntries.value);
  const switchScopes = new Set(
    prepopulatedScopeLabels(selectedRole.value.roleKey, scopeContext.value).map(
      ({ scope }) => scopeKey(scope.target, scope.selector),
    ),
  );
  const isSwitch = (call: (typeof calls)[number]) =>
    FUNCTION_GRANTS.includes(call.description.action) &&
    switchScopes.has(scopeKey(call.description.target, call.description.selector));

  const saved: IRawPermissionCodeEntry[] = [];
  // Contracts that carry a switch's grant: not the card's to close.
  const switchTargets = new Set<string>();

  for (const call of calls) {
    const { action, target } = call.description;
    if (isSwitch(call)) {
      switchTargets.add((target ?? "").toLowerCase());
    } else if (TARGET_GRANTS.includes(action)) {
      const functions = calls.filter(
        (other) =>
          FUNCTION_GRANTS.includes(other.description.action) &&
          other.description.target?.toLowerCase() === target?.toLowerCase(),
      );
      if (!functions.length || !functions.every(isSwitch)) {
        saved.push(storedEntries.value[call.index]);
      }
    } else {
      saved.push(storedEntries.value[call.index]);
    }
  }
  return { saved, switchTargets };
});

/** What the role stores beyond its switches. */
const savedEntries = computed(() => storedSplit.value.saved);

// Custom permissions the vault already stores for the admin switch the
// section on, unless it was already switched by hand.
watch(
  () => isAdminSelected.value && savedEntries.value.length > 0,
  (adminHasSaved) => {
    if (adminHasSaved && !isAdminCustomTouched.value) adminCustomEnabled.value = true;
  },
  { immediate: true },
);
const savedCalls = computed(() => describeQueuedCalls(savedEntries.value));

/** What storing the card as it stands would take back, by scope key. */
const autoRevoked = computed(() => {
  const scopes = new Set<string>();
  const draft = drafts.value[selectedKey.value];
  if (!savedLogs.value || !roleModAddress.value || !draft) return scopes;
  try {
    const revoked = integrationScopesToRevoke({
      chainId: fundChainId.value,
      protocolBuild: buildProtocolPermissionEntries({
        chainId: fundChainId.value,
        rolesModAddress: roleModAddress.value,
        selections: draft.selections,
        roleKey: selectedRole.value.roleKey,
      }),
      current: reduceRoleScopeLogs(savedLogs.value, selectedRole.value.key),
      ...scopeContext.value,
      roleKey: selectedRole.value.roleKey,
      protocols: draft.touched,
    });
    for (const scope of revoked) scopes.add(scopeKey(scope.target, scope.selector));
  } catch {
    // Selections that do not compile yet take nothing back: the save itself
    // refuses them before anything is sent.
  }
  return scopes;
});

/** Revokes already queued on the card for this role, by scope key (and bare target). */
const queuedRevokes = computed(() => {
  const scopes = new Set<string>();
  for (const { description } of describeQueuedCalls(rawPermissionCodeEntries.value)) {
    if (description.role !== selectedRole.value.label) continue;
    if (description.action === "revoke-function") {
      scopes.add(scopeKey(description.target, description.selector));
    } else if (description.action === "revoke-target") {
      scopes.add(scopeKey(description.target, "target"));
    }
  }
  return scopes;
});

/**
 * Per stored call: the line under it, and whether it can be removed here.
 * Anything a pending save takes back says so before it does; a contract one
 * of the role's switches also grants on cannot be closed from here.
 */
const savedAnnotations = computed(() => {
  const notes: Record<number, { text: string; tone?: "muted" | "warn" }> = {};
  const locked: number[] = [];
  const REMOVED = { text: "Removed when you store permissions", tone: "warn" as const };
  const UNSELECTED = {
    text: "Removed when you store permissions: no longer selected below",
    tone: "warn" as const,
  };

  for (const call of savedCalls.value) {
    const { action, target, selector } = call.description;
    if (FUNCTION_GRANTS.includes(action)) {
      const key = scopeKey(target, selector);
      if (queuedRevokes.value.has(key)) {
        notes[call.index] = REMOVED;
        locked.push(call.index);
      } else if (autoRevoked.value.has(key)) {
        notes[call.index] = UNSELECTED;
      }
    } else if (TARGET_GRANTS.includes(action)) {
      if (storedSplit.value.switchTargets.has((target ?? "").toLowerCase())) {
        notes[call.index] = { text: "Also used by the prepopulated permissions" };
        locked.push(call.index);
      } else if (queuedRevokes.value.has(scopeKey(target, "target"))) {
        notes[call.index] = REMOVED;
        locked.push(call.index);
      } else if (autoRevoked.value.has(scopeKey(target, "0x00000000"))) {
        notes[call.index] = UNSELECTED;
      }
    }
  }
  return { notes, locked };
});
const savedNotes = computed(() => savedAnnotations.value.notes);
const savedLocked = computed(() => savedAnnotations.value.locked);

/**
 * Remove stored permissions: queue the revoke calls on the card, where they
 * can be read (and discarded) like any other raw call before being stored.
 * Removing a contract's opening row removes the whole contract. A function
 * grant left behind would come back to life the next time it is opened.
 */
const removeSaved = (indices: number[]) => {
  const calls = savedCalls.value;
  const locked = new Set(savedLocked.value);
  const roleKeyBytes = selectedRole.value.key;
  const revokes: string[] = [];
  const revokeFunction = (target: string, selector: string) =>
    revokes.push(
      rolesInterface.encodeFunctionData("revokeFunction", [roleKeyBytes, target, selector]),
    );

  for (const index of indices) {
    const call = calls[index];
    if (!call || locked.has(index)) continue;
    const { action, target, selector } = call.description;
    if (!target) continue;
    if (FUNCTION_GRANTS.includes(action) && selector) {
      revokeFunction(target, selector);
    } else if (TARGET_GRANTS.includes(action)) {
      for (const other of calls) {
        if (
          FUNCTION_GRANTS.includes(other.description.action) &&
          other.description.selector &&
          other.description.target?.toLowerCase() === target.toLowerCase()
        ) {
          revokeFunction(target, other.description.selector);
        }
      }
      revokes.push(
        rolesInterface.encodeFunctionData("revokeTarget", [roleKeyBytes, target]),
      );
    }
  }

  const queued = new Set(rawPermissionCodeEntries.value.map((entry) => entry.data));
  const fresh = [...new Set(revokes)].filter((data) => !queued.has(data));
  if (!fresh.length) return;
  rawPermissionCodeEntries.value = [
    ...rawPermissionCodeEntries.value,
    ...parseRawPermissionCode(JSON.stringify(fresh)),
  ];
};

/* ---- Storing ------------------------------------------------------------- */

// Bumped by every successful save: the member list is read again.
const savedCount = ref(0);

const navExecutorAddress = computed(() =>
  useContractAddresses().getNAVExecutorBeaconProxyAddress(fundChainId.value),
);
const poolPerformanceFeeAddress = computed(
  () =>
    useContractAddresses().rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[
      fundChainId.value
    ],
);

const storePermissions = async () => {
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  const fundAddress = fundInitCache?.value?.fundContractAddr;

  if (
    !roleModAddress.value ||
    !fundAddress ||
    !fundInitCacheSettings?.baseToken
  ) {
    console.error("Missing fund init cache data", fundInitCache);
    throw new Error(
      "Something went wrong while storing permissions. Missing fund init cache data.",
    );
  }

  // Captured after the guard above so the closures below keep the narrowed
  // type.
  const rolesModifierAddress = roleModAddress.value;

  // The two built-in roles' switches. Saving makes the modifier match them
  // in both directions (one that is off is revoked, not merely left out),
  // and this part of the batch depends on the switches alone.
  let prepopulated;
  try {
    prepopulated = buildPrepopulatedPermissionsBatch(
      {
        fundAddress,
        baseToken: fundInitCacheSettings.baseToken,
        rolesModifier: rolesModifierAddress,
        navExecutor: navExecutorAddress.value,
        poolPerformanceFee: poolPerformanceFeeAddress.value,
        executorRoleKey: executorRoleKey.value,
        // Pinned to the values the factory will store: the raw init-cache
        // settings struct, metadata string and the two fee periods, never
        // derived frontend state. (The init-cache rewrite in
        // fetchFundInitCache only ADDS frontend keys; the raw fields used
        // here are untouched.)
        rawSettings: fundInitCacheSettings,
        fundMetadata: fundInitCache?.value?._fundMetadata,
        feePerformancePeriod: fundInitCache?.value?._feePerformancePeriod,
        feeManagePeriod: fundInitCache?.value?._feeManagePeriod,
      },
      rolePermissions.value,
    );
  } catch (e: any) {
    console.error("Failed to build the role permissions", e);
    throw new Error("Failed to build the role permissions: " + e.message);
  }

  // Every role with something on its protocol card is stored, not only the
  // one on screen. Invalid selections (an added protocol with nothing
  // picked) block the save before anything is encoded, and the registry's
  // typed errors abort it the same way.
  const builds = stepRoles.value
    .filter(
      (role) =>
        hasChanges(drafts.value[role.key]) &&
        (role.key !== ADMIN_KEY ||
          (rolePermissions.value.adminEnabled && adminCustomEnabled.value)),
    )
    .map((role) => {
      const draft = drafts.value[role.key];
      const prefix = role.key === selectedRole.value.key ? "" : `${role.name}: `;
      const issues = validateProtocolSelections(fundChainId.value, draft.selections);
      if (issues.length) throw new Error(prefix + issues[0].message);
      try {
        return {
          role,
          draft,
          protocolBuild: buildProtocolPermissionEntries({
            chainId: fundChainId.value,
            rolesModAddress: rolesModifierAddress,
            selections: draft.selections,
            roleKey: role.roleKey,
          }),
        };
      } catch (e: any) {
        console.error("Failed to build protocol permissions", e);
        throw new Error(`${prefix}Failed to build protocol permissions: ${e.message}`);
      }
    });

  loading.value = true;

  // With the admin role switched off, nobody is added to it, and whoever an
  // earlier save put there is taken off, so "off" leaves a role with neither
  // permissions nor members. The member read is best effort: the role's
  // permissions are revoked either way, which is what makes it powerless.
  let adminChanges = pendingMembers.value[ADMIN_KEY] ?? [];
  if (!rolePermissions.value.adminEnabled) {
    adminChanges = [];
    try {
      adminChanges = (
        await fetchRoleMembers(fundChainId.value, rolesModifierAddress, ADMIN_ROLE_KEY_V2)
      ).map((address) => ({ address, action: "REMOVE" as const }));
    } catch (e) {
      console.warn("Could not read the admin role's members", e);
    }
  }
  const memberEntries = stepRoles.value.flatMap((role) =>
    getAssignMembersRoleV2(
      role.roleKey,
      role.key === ADMIN_KEY ? adminChanges : (pendingMembers.value[role.key] ?? []),
    ),
  );

  // What the modifier grants each role right now, replayed from its own
  // event log and read again at the moment of saving. The protocol diff
  // takes back only stale grants of the protocols on the card instead of
  // sweeping the whole grantable universe (which grew with the catalog until
  // a save approached the block gas limit). Throws when no source is fresh,
  // and the save is aborted: a stale read would under-revoke silently. A save
  // that touched no protocol card needs no read, and does not wait on one.
  let logs: IRoleScopeLog[] = [];
  if (builds.length) {
    logs = await fetchRoleScopeLogs(fundChainId.value, rolesModifierAddress);
    savedLogs.value = logs;
  }

  const proposalData = prepPermissionsProposalData(rolesModifierAddress, []);
  proposalData.encodedRoleModEntries.push(
    ...buildPermissionsPageBatch({
      prepopulated,
      memberEntries,
      roles: builds.map(
        ({ role, draft, protocolBuild }): IRoleBatchOptions => ({
          chainId: fundChainId.value,
          protocolBuild,
          current: reduceRoleScopeLogs(logs, role.key),
          fundAddress,
          baseToken: fundInitCacheSettings.baseToken,
          rolesModifier: rolesModifierAddress,
          roleKey: role.roleKey,
          protocols: draft.touched,
        }),
      ),
      rawEntries: rawPermissionCodeEntries.value.map((entry) => entry.data),
    }),
  );

  for (const { role, protocolBuild } of builds) {
    if (!protocolBuild.entries.length) continue;
    console.log(
      `protocol permissions for ${role.name} (registry v${protocolBuild.packageVersion})`,
      protocolBuild.selections,
      protocolBuild.descriptions,
    );
  }

  const fundFactoryContract =
    web3Store.chainContracts[fundChainId.value]?.fundFactoryContractV2;

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
        // The freshness floor for the next read of the role's state: a log
        // source that has not indexed this block yet is stale by proof.
        recordPermissionsSaveBlock(
          fundChainId.value,
          rolesModifierAddress,
          Number(receipt.blockNumber),
        );
        // The queued members and raw calls are on the vault now; what is
        // stored is read again so the page shows them there instead of
        // still waiting here.
        pendingMembers.value = {};
        rawPermissionCodeEntries.value = [];
        savedCount.value++;
        loadSaved();
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
};

/**
 * The step's primary action lives in the page's sticky footer, where every
 * other step's does; this is what that button calls. Everything the save
 * does before .send() (the role-state read, the registry build, the
 * encoders) runs inside this handler, so a throw becomes a toast instead of
 * an unhandled rejection and a button spinning forever.
 */
const finalizePermissions = async () => {
  if (!fundFactoryContractV2Used.value) return legacyRef.value?.finalizePermissions();
  try {
    await storePermissions();
  } catch (error: any) {
    console.error("Failed storing permissions", error);
    loading.value = false;
    toastStore.errorToast(
      error?.message ?? "Storing permissions failed before submission.",
    );
  }
};

defineExpose({
  finalizePermissions,
  isFinalizing: computed(() =>
    fundFactoryContractV2Used.value ? loading.value : !!legacyRef.value?.isFinalizing,
  ),
  /** False only on a Roles V1 vault's second sub-step, which saves itself. */
  isOnFirstSubStep: computed(
    () => fundFactoryContractV2Used.value || (legacyRef.value?.isOnFirstSubStep ?? true),
  ),
});
</script>

<style scoped lang="scss">
.perm_step {
  display: flex;
  flex-direction: column;

  &__title_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
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

  &__lead {
    margin-top: 0.375rem;
    font-size: 13px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  /* The roles, as tabs: number and name, the selected one accented. */
  &__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem 0.5rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    color: $color-steel-blue;
    cursor: pointer;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
      border-color: $color-line-3;
    }

    &--active,
    &--active:hover,
    &--active:focus-visible {
      border-color: $color-accent-line;
      background: $color-accent-soft;
      color: $color-white;
    }

    /* The way to another role, not a role: dashed, like the add tiles. */
    &--add {
      gap: 0.25rem;
      padding-left: 0.5rem;
      border-style: dashed;
    }
  }

  &__tab_number {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__tab--active &__tab_number {
    color: $color-cyan;
  }

  &__tab_name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }

  /* A role the vault runs without says so on its tab. */
  &__tab_state {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__tab--off &__tab_name {
    color: $color-steel-blue;
  }

  &__panel {
    margin-top: 0.75rem;
  }

  &__protocols {
    margin-top: 1rem;
  }

  &__saved {
    margin-top: 1rem;
  }

  /* What is stored could not be read: one quiet line where the list would
     be. */
  &__saved_empty {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.875rem;
    padding: 0.75rem 1rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-size: 13px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__saved_error {
    color: $color-warning;
  }

  &__refresh {
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__tab {
      transition: none;
    }
  }

}
</style>
