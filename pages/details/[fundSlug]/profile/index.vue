<template>
  <div v-if="appSettingsStore.isManageMode" class="curator_profile">
    <div
      v-if="!fund?.fundFactoryContractV2Used"
      class="curator_profile__unsupported"
    >
      Curator profile management needs a Roles V2 vault. This vault's
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

      <v-skeleton-loader v-if="isLoading" type="article" />
      <template v-else>
        <section class="curator_profile__section">
          <h2 class="curator_profile__title">
            Vault profile
          </h2>
          <div class="curator_profile__grid">
            <div class="curator_profile__cell curator_profile__cell--12">
              <OnboardingImageUpload
                v-model="photoField.value"
                :field="photoField"
              />
            </div>
            <div
              v-for="field in editableFields"
              :key="field.key"
              class="curator_profile__cell"
              :class="`curator_profile__cell--${field.cols ?? 12}`"
            >
              <OnboardingFieldControl
                v-model="field.value"
                :field="field"
              />
            </div>
            <div class="curator_profile__cell curator_profile__cell--12">
              <OnboardingPeriodControl
                v-model="settlementField.value"
                :field="settlementField"
                :chain-id="fund.chainId"
                :disabled="true"
                wide
              />
              <p class="curator_profile__governance_note">
                The planned settlement period is upgradable through governance,
                not from curator mode.
              </p>
            </div>
          </div>
        </section>

        <div class="curator_profile__actions">
          <span v-if="isDirty" class="curator_profile__pending">
            Unsaved changes
          </span>
          <v-btn
            variant="text"
            color="secondary"
            :disabled="!isDirty || isSubmitting"
            @click="resetFromChain"
          >
            Discard
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!isDirty"
            :loading="isSubmitting"
            @click="saveChanges"
          >
            Save vault profile
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
} from "~/composables/permissions/useRoleExecution";
import { fetchActivationState } from "~/composables/permissions/activationProposal";
import { uploadVaultImage } from "~/composables/vaultImage";
import { FieldTag } from "~/types/enums/stepper_onboarding";
import { InputType, type IField } from "~/types/enums/input_type";
import type IFund from "~/types/fund";

/**
 * Curator-mode vault profile: the metadata half of updateSettings that the
 * Roles permission leaves open. Edits are merged into the LIVE metadata JSON
 * (unknown keys survive untouched) and submitted through the Roles modifier;
 * the settings struct itself is echoed verbatim, so nothing here can drift a
 * pinned field.
 */
const fundStore = useFundStore();
const appSettingsStore = useSettingsStore();
const toastStore = useToastStore();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(fundStore);

const isLoading = ref(true);
const isSubmitting = ref(false);
const roleModAddress = ref("");
const needsActivation = ref(false);
// The metadata as last loaded from chain, for dirty checking and merging.
const savedMetadata = ref<Record<string, any>>({});

// The metadata keys curator mode may write. plannedSettlementPeriod lives in
// the same JSON but is governance-tagged in the create flow, so it renders
// read-only below and never enters this list.
const EDITABLE_KEYS = [
  "description",
  "strategistName",
  "strategistUrl",
  "oivChatUrl",
] as const;

const photoField = reactive<IField>({
  label: "Vault image",
  key: "photoUrl",
  type: InputType.Image,
  placeholder: "",
  rules: [formRules.required],
  tag: FieldTag.UpgradableCurator,
  value: "",
});

const editableFields = reactive<IField[]>([
  {
    label: "Description",
    key: "description",
    type: InputType.Textarea,
    placeholder: "E.g. Description",
    charLimit: 5000,
    rules: [formRules.required, formRules.charLimit(5000)],
    tag: FieldTag.UpgradableCurator,
    cols: 12,
    value: "",
  },
  {
    label: "Strategist name",
    key: "strategistName",
    type: InputType.Text,
    placeholder: "E.g. rethink.finance",
    tooltip: "Displayed next to the vault name.",
    rules: [formRules.required],
    tag: FieldTag.UpgradableCurator,
    cols: 6,
    value: "",
  },
  {
    label: "Strategist link",
    key: "strategistUrl",
    type: InputType.Text,
    placeholder: "E.g. https://rethink.finance",
    tooltip: "Strategist name becomes clickable and redirects here.",
    rules: [formRules.required],
    tag: FieldTag.UpgradableCurator,
    cols: 6,
    value: "",
  },
  {
    label: "Vault chat link",
    key: "oivChatUrl",
    type: InputType.Text,
    placeholder: "E.g. https://discord.com/channels/945238616408481833",
    rules: [],
    tag: FieldTag.UpgradableCurator,
    cols: 12,
    value: "",
  },
]);

const settlementField = reactive<IField>({
  label: "Planned settlement period",
  key: "plannedSettlementPeriod",
  type: InputType.Period,
  placeholder: "E.g. 0",
  rules: [],
  tag: FieldTag.UpgradableGovernance,
  value: "",
});

const fieldByKey = (key: string): IField =>
  editableFields.find((field) => field.key === key) as IField;

const isDirty = computed(() => {
  if ((photoField.value ?? "") !== (savedMetadata.value.photoUrl ?? "")) {
    return true;
  }
  return EDITABLE_KEYS.some(
    (key) => (fieldByKey(key).value ?? "") !== (savedMetadata.value[key] ?? ""),
  );
});

const parseMetadata = (raw: string): Record<string, any> => {
  try {
    return JSON.parse(raw || "{}") ?? {};
  } catch {
    return {};
  }
};

const resetFromChain = async () => {
  if (!fund?.address) return;
  isLoading.value = true;
  try {
    const live = await fetchLiveFundSettingsState(fund.chainId, fund.address);
    const metadata = parseMetadata(live.fundMetadata);
    savedMetadata.value = metadata;
    photoField.value = metadata.photoUrl ?? "";
    for (const key of EDITABLE_KEYS) {
      fieldByKey(key).value = metadata[key] ?? "";
    }
    settlementField.value = String(metadata.plannedSettlementPeriod ?? "0");
  } catch (error: any) {
    console.error("Failed loading vault profile", error);
    toastStore.errorToast(
      error?.message || "Failed loading the vault profile. Please refresh.",
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
    // A freshly dropped image is still a data URL; swap it for a hosted one
    // before it can land in on-chain metadata.
    photoField.value = await uploadVaultImage(String(photoField.value ?? ""));

    // Merge onto the CURRENT live metadata, not the one loaded at mount —
    // only the curator-editable keys move, everything else rides along.
    const live = await fetchLiveFundSettingsState(fund.chainId, fund.address);
    const metadata = parseMetadata(live.fundMetadata);
    metadata.photoUrl = photoField.value;
    for (const key of EDITABLE_KEYS) {
      metadata[key] = fieldByKey(key).value ?? "";
    }

    const call = {
      to: fund.address,
      data: buildCuratorUpdateSettingsCalldata(live, {
        fundMetadata: JSON.stringify(metadata),
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
          : simulation.reason || "The Roles modifier denied this call.",
        10000,
      );
      return;
    }

    await sendRoleExecution(fund.chainId, roleModAddress.value, call)
      .on("transactionHash", () => {
        toastStore.addToast(
          "Vault profile update submitted. Please wait for confirmation.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast("Vault profile updated.");
        } else {
          toastStore.errorToast("The vault profile update failed.");
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
    toastStore.errorToast(
      error?.message || "Failed saving the vault profile.",
    );
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
.curator_profile {
  &__unsupported {
    padding: 2rem;
    text-align: center;
    color: $color-steel-blue;
  }

  &__title {
    margin-bottom: 1.375rem;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    column-gap: 1.25rem;
    row-gap: 0.5rem;
  }

  &__cell {
    grid-column: span 12;

    @include md {
      &--6 {
        grid-column: span 6;
      }
      &--12 {
        grid-column: span 12;
      }
    }
  }

  &__governance_note {
    margin-top: 0.375rem;
    font-size: 12px;
    line-height: 1.5;
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
