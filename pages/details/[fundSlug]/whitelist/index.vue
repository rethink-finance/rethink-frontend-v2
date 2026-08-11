<template>
  <div v-if="appSettingsStore.isManageMode" class="curator_whitelist">
    <div
      v-if="!fund?.fundFactoryContractV2Used"
      class="curator_whitelist__unsupported"
    >
      Curator whitelist management needs a Roles V2 vault. This vault's
      permissions run on Roles V1 — use a governance fund-settings proposal
      instead.
    </div>

    <UiMainCard v-else class="brand_card">
      <div v-if="needsActivation" class="activation_note">
        <strong>Manager permissions pending activation</strong>
        <p>
          The "update vault settings" permission is granted but stays inert
          until the one-time activation proposal has passed. Changes saved
          here would revert on the vault until then.
        </p>
        <NuxtLink
          class="activation_note__link"
          :to="`/details/${selectedFundSlug}/permissions`"
        >
          Go to Permissions to create the activation proposal
        </NuxtLink>
      </div>

      <v-skeleton-loader v-if="isLoading" type="table-row@4" />
      <template v-else>
        <OnboardingWhitelist
          v-model="whitelist"
          v-model:whitelist-enabled="isWhitelistedDeposits"
          :is-editable="true"
          :dim-when-disabled="false"
        />
        <p class="curator_whitelist__hint">
          <template v-if="!chainWhitelistEnabled">
            Deposits are currently permissionless: the list below is stored
            but not enforced.
          </template>
          <template v-else>
            Deposits are currently restricted to the list below.
          </template>
          <template v-if="isToggleChanged">
            Saving turns enforcement
            <strong>{{ isWhitelistedDeposits ? "on" : "off" }}</strong>
            {{
              isWhitelistedDeposits
                ? "— only the addresses below will be able to deposit."
                : "— anyone will be able to deposit."
            }}
          </template>
          <template v-else>
            Both the enforcement toggle and the addresses are maintained by
            the manager role; changes take effect when you save.
          </template>
        </p>

        <div class="curator_whitelist__actions">
          <span v-if="pendingChangeCount" class="curator_whitelist__pending">
            {{ pendingChangeCount }} pending
            change{{ pendingChangeCount === 1 ? "" : "s" }}
          </span>
          <v-btn
            variant="text"
            color="secondary"
            :disabled="!pendingChangeCount || isSubmitting"
            @click="resetFromChain"
          >
            Discard
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!pendingChangeCount"
            :loading="isSubmitting"
            @click="saveChanges"
          >
            Save whitelist changes
          </v-btn>
        </div>
      </template>
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { useToastStore } from "~/store/toasts/toast.store";
import {
  buildCuratorUpdateSettingsCalldata,
  fetchLiveFundSettingsState,
  sendRoleExecution,
  simulateRoleExecution,
  type ILiveFundSettingsState,
} from "~/composables/permissions/useRoleExecution";
import { fetchActivationState } from "~/composables/permissions/activationProposal";
import type IFund from "~/types/fund";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

/**
 * Curator-mode whitelist maintenance. Reads the live depositor whitelist off
 * the fund, lets the manager flip enforcement and queue address
 * additions/removals, and submits ONE updateSettings through the Roles
 * modifier whose allowedDepositAddrs array carries only the deltas —
 * updateSettings XOR-toggles each passed address, so the array must never
 * echo unchanged entries.
 */
const fundStore = useFundStore();
const appSettingsStore = useSettingsStore();
const toastStore = useToastStore();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(fundStore);

const isLoading = ref(true);
const isSubmitting = ref(false);
const whitelist = ref<IWhitelist[]>([]);
// The edited enforcement flag vs. the value last read off the chain — the
// permission wildcards this field, so flipping it is a manager action like
// any address change.
const isWhitelistedDeposits = ref(false);
const chainWhitelistEnabled = ref(false);
const roleModAddress = ref("");
const needsActivation = ref(false);
const liveState = ref<ILiveFundSettingsState | null>(null);

const isToggleChanged = computed(
  () => isWhitelistedDeposits.value !== chainWhitelistEnabled.value,
);

const pendingChangeCount = computed(
  () => whitelistDeltas.value.length + (isToggleChanged.value ? 1 : 0),
);

// XOR-toggle deltas: brand-new rows flip ON, deleted existing rows flip OFF.
// A row that is added and then discarded never reaches this list because the
// component drops isNew rows outright on remove.
const whitelistDeltas = computed(() =>
  whitelist.value
    .filter((item) => (item.isNew && !item.deleted) || (!item.isNew && item.deleted))
    .map((item) => item.address),
);

const resetFromChain = async () => {
  if (!fund?.address) return;
  isLoading.value = true;
  try {
    const live = await fetchLiveFundSettingsState(fund.chainId, fund.address);
    liveState.value = live;
    chainWhitelistEnabled.value = Boolean(live.settings.isWhitelistedDeposits);
    isWhitelistedDeposits.value = chainWhitelistEnabled.value;
    whitelist.value = (live.settings.allowedDepositAddrs ?? []).map(
      (address: string) => ({ address, isNew: false, deleted: false }),
    );
  } catch (error: any) {
    console.error("Failed loading whitelist", error);
    toastStore.errorToast(
      error?.message || "Failed loading the whitelist. Please refresh.",
    );
  } finally {
    isLoading.value = false;
  }
};

const refreshActivationState = async () => {
  try {
    roleModAddress.value = await fundStore.fetchRoleModAddress(fund.address);
    const state = await fetchActivationState(
      fund.chainId,
      fund.address,
      roleModAddress.value || null,
    );
    needsActivation.value = state.needsGovernorMigration;
  } catch (error) {
    console.error("Failed reading activation state", error);
  }
};

const saveChanges = async () => {
  if (!roleModAddress.value) {
    toastStore.errorToast("Roles modifier address is not available yet.");
    return;
  }
  isSubmitting.value = true;
  try {
    // Re-read live state right before encoding: every echoed field is pinned
    // exactly by the Roles permission, so a stale echo fails as an opaque
    // permission denial.
    const live = await fetchLiveFundSettingsState(fund.chainId, fund.address);
    liveState.value = live;
    const call = {
      to: fund.address,
      data: buildCuratorUpdateSettingsCalldata(live, {
        whitelistDeltas: whitelistDeltas.value,
        // Send the flag only when the manager actually flipped it, so an
        // address-only save still echoes whatever the chain holds now.
        isWhitelistedDeposits: isToggleChanged.value
          ? isWhitelistedDeposits.value
          : undefined,
      }),
    };

    const simulation = await simulateRoleExecution(
      fund.chainId,
      roleModAddress.value,
      call,
    );
    if (!simulation.ok) {
      toastStore.errorToast(
        simulation.innerRevert
          ? "The vault rejected this update — the manager permissions are " +
            "likely still pending governance activation (see the " +
            "Permissions page)."
          : (simulation.reason || "The Roles modifier denied this call.") +
            // Vaults whose permissions were granted before the flag became
            // manager-editable still pin it, and that denial reads as a
            // generic parameter mismatch.
            (isToggleChanged.value
              ? " If this vault's permissions were granted before whitelist " +
                "enforcement became manager-editable, the flag is still " +
                "pinned on-chain and a new permissions proposal is needed to " +
                "change it."
              : ""),
        10000,
      );
      return;
    }

    await sendRoleExecution(fund.chainId, roleModAddress.value, call)
      .on("transactionHash", () => {
        toastStore.addToast(
          "Whitelist update submitted. Please wait for confirmation.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast("Whitelist updated.");
        } else {
          toastStore.errorToast("The whitelist update transaction failed.");
        }
        resetFromChain();
      })
      .on("error", (error: any) => {
        console.error(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(error?.message || "Failed saving the whitelist.");
  } finally {
    isSubmitting.value = false;
  }
};

watch(
  () => fund?.address,
  () => {
    if (!fund?.address) return;
    resetFromChain();
    refreshActivationState();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.curator_whitelist {
  &__unsupported {
    padding: 2rem;
    text-align: center;
    color: $color-steel-blue;
  }

  &__hint {
    max-width: 62ch;
    margin-top: 0.875rem;
    font-size: 12.5px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  &__pending {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-cyan;
  }
}

.activation_note {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.375rem;
  padding: 1rem 1.25rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-size: 13px;
  line-height: 1.5;
  color: $color-steel-blue;

  strong {
    color: $color-white;
  }

  &__link {
    color: $color-primary;
    text-decoration: underline;
  }
}
</style>
