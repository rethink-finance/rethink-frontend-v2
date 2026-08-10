<template>
  <div v-if="appSettingsStore.isManageMode" class="permissions">
    <div
      v-if="fund?.fundFactoryContractV2Used"
      class="d-flex flex-column flex-grow-1 justify-center align-center"
    >
      This OIV is using Roles Modifier V2.
      <UiLinkExternalButton
        title="View or Edit Roles V2"
        :href="gnosisRolesUrl"
        width="230px"
        class="mt-4"
      />

      <div v-if="activationState" class="activation_card mt-8">
        <template v-if="needsActivation">
          <strong>Manager permissions pending activation</strong>
          <p v-if="activationState.needsGovernorMigration">
            The "update vault settings" permission stays inert until
            governance hands settings authority to the Safe (one-time
            <code>governor&nbsp;→&nbsp;Safe</code> settings change).
          </p>
          <p v-if="activationState.needsOwnershipTransfer">
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
            @click="createActivationProposal"
          >
            Create activation proposal
          </v-btn>
        </template>
        <template v-else>
          <strong>Manager permissions activated</strong>
          <p>
            Settings authority and Roles modifier ownership are held by the
            Safe.
          </p>
        </template>
      </div>
    </div>
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

const router = useRouter();
const fundStore = useFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const appSettingsStore = useSettingsStore();
const roleStore = useRoleStore();
const toastStore = useToastStore();
const actionStateStore = useActionStateStore();

const { selectedFundSlug } = storeToRefs(useFundStore());
const fund = useAttrs().fund as IFund;

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

const fetchRolesAndPermissions = async () => {
  if (!fund?.address) {
    roles.value = [];
    return;
  }

  try {
    roleModAddress.value = await fundStore.fetchRoleModAddress(fund.address);
    await fetchPermissions(roleModAddress.value);
  } catch (error) {
    console.error(error);
    toastStore.errorToast("Failed loading permissions. Please refresh page.");
  }
  await refreshActivationState();
};

const navigateToCreatePermissions = async () => {
  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(fund.chainId);
  } catch (e: any) {
    console.error("Failed updating role", e);
  }

  router.push(
    `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  );
};

watch(
  () => [fund?.chainShort, fund?.address],
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
