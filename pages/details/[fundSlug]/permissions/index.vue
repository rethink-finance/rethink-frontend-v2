<template>
  <div v-if="appSettingsStore.isManageMode" class="permissions">
    <UiMainCard
      v-if="fund?.fundFactoryContractV2Used"
      class="permissions__content brand_card"
    >
      <div class="v2_head">
        <span class="v2_head__badge">Roles V2</span>
        <div class="v2_head__buttons">
          <UiLinkExternalButton
            title="View vault permissions"
            :href="gnosisRolesUrl"
          />
          <v-btn
            color="primary"
            variant="outlined"
            @click="navigateToCreatePermissions"
          >
            Generate permissions proposal
          </v-btn>
        </div>
      </div>
      <p class="v2_hint">
        Permission changes (targets, functions, pinned parameters) go through
        governance. Role membership below executes directly through the
        manager role.
      </p>

      <div v-if="needsActivation" class="activation_card mt-6">
        <strong>Manager permissions pending activation</strong>
        <p v-if="activationState?.needsGovernorMigration">
          The "update vault settings" permission stays inert until
          governance hands settings authority to the Safe (one-time
          <code>governor&nbsp;→&nbsp;Safe</code> settings change).
        </p>
        <p v-if="activationState?.needsOwnershipTransfer">
          The "manage role members" permission stays inert until governance
          transfers the Roles modifier's ownership to the Safe.
        </p>
        <p class="activation_card__hint">
          One proposal covers everything still pending. The whitelist is
          untouched: the proposal echoes current settings with empty
          depositor/manager arrays (those arrays are toggle deltas, not
          absolute lists).
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

      <!-- Membership: reads straight off the modifier, writes through the
           manager role's own assignRoles permission. -->
      <div class="members mt-6">
        <OnboardingRoleMembers
          ref="roleMembersRef"
          v-model="pendingMemberChanges"
          :chain-id="fund.chainId"
          :roles-mod-address="roleModAddress"
        />

        <div class="members__actions">
          <v-btn
            color="primary"
            :disabled="!pendingMemberChanges.length"
            :loading="isExecutingMemberChanges"
            @click="executeMemberChanges"
          >
            Execute member changes
          </v-btn>
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
  sendRoleExecution,
  simulateRoleExecution,
} from "~/composables/permissions/useRoleExecution";
import { clearCuratorRoleCache } from "~/composables/permissions/useCuratorExecution";
import type { IAssignMemberChange } from "~/composables/nav/generateNAVPermission";
import {
  NO_DELEGATES_TITLE,
  useProposalDelegation,
} from "~/composables/governance/useProposalDelegation";

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

// One-time governance activation of the manager's update-settings /
// role-members permissions (Roles V2 vaults only).
const activationState = ref<IActivationState | null>(null);
const isCreatingActivationProposal = ref(false);
const needsActivation = computed(
  () =>
    activationState.value?.needsGovernorMigration ||
    activationState.value?.needsOwnershipTransfer,
);

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
    );
    if (!actions.targets.length) {
      toastStore.addToast("Nothing left to activate.");
      await refreshActivationState();
      return;
    }
    await fundStore.fundGovernorContract
      .send(
        "propose",
        {},
        actions.targets,
        actions.gasValues,
        actions.calldatas,
        JSON.stringify({
          title: "Activate manager vault-settings & role-member permissions",
          description:
            "One-time activation: hand settings authority to the Safe " +
            "(governor = safe, whitelist arrays left empty on purpose — " +
            "they are toggle deltas) and/or transfer Roles modifier " +
            "ownership to the Safe, so the manager's granted Roles V2 " +
            "permissions become executable.",
        }),
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
// them goes through the manager role's own assignRoles permission.
const roleMembersRef = ref<{ reload: () => Promise<void> } | null>(null);
const pendingMemberChanges = ref<IAssignMemberChange[]>([]);
const isExecutingMemberChanges = ref(false);

const executeMemberChanges = async () => {
  if (!roleModAddress.value || !pendingMemberChanges.value.length) return;
  isExecutingMemberChanges.value = true;
  try {
    // One execTransactionWithRole per change, sequentially — each is its own
    // wallet signature, and a failure stops the queue so nothing is skipped
    // silently.
    for (const change of [...pendingMemberChanges.value]) {
      const call = {
        to: roleModAddress.value,
        data: buildAssignRolesCalldata(change.address, change.action === "ADD"),
      };
      const simulation = await simulateRoleExecution(
        fund.chainId,
        roleModAddress.value,
        call,
      );
      if (!simulation.ok) {
        toastStore.errorToast(
          simulation.innerRevert
            ? "The modifier rejected this change — role-member management " +
              "is likely still pending governance activation (see above)."
            : simulation.reason || "The Roles modifier denied this call.",
          10000,
        );
        return;
      }
      await sendRoleExecution(fund.chainId, roleModAddress.value, call).on(
        "transactionHash",
        () => {
          toastStore.addToast(
            `Membership change for ${change.address} submitted.`,
          );
        },
      );
      // Drop the executed change so a mid-queue failure keeps the rest.
      pendingMemberChanges.value = pendingMemberChanges.value.filter(
        (item) => item !== change,
      );
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
    // Membership drives the execution buttons on the NAV / settlement /
    // execution pages, so drop what they cached about it.
    clearCuratorRoleCache();
  }
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
  await refreshActivationState();
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

.members {
  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
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
