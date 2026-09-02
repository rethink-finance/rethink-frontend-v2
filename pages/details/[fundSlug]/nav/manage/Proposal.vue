<template>
  <div class="nav_proposal">
    <div class="nav_proposal__header">
      <h2 class="nav_proposal__title">
        Create NAV proposal
      </h2>
      <p class="nav_proposal__meta">
        Last NAV update · {{ fundLastNAVUpdateDate }}
      </p>
    </div>

    <FundGovernanceDelegationNotice />

    <v-form
      ref="form"
      v-model="formIsValid"
      class="nav_proposal__card brand_card"
    >
      <!-- Proposal Title -->
      <div class="nav_proposal__field">
        <div class="nav_proposal__label_row">
          <span class="nav_proposal__label">
            Proposal title<span class="nav_proposal__star">*</span>
          </span>
          <UiCharLimit
            class="nav_proposal__limit"
            :char-limit="150"
            :char-number="proposal.title"
          />
        </div>
        <v-text-field
          v-model="proposal.title"
          placeholder="Type here"
          required
        />
      </div>

      <!-- Management -->
      <div class="nav_proposal__field">
        <span class="nav_proposal__label">
          Management
        </span>
        <div class="nav_proposal__rows">
          <div class="nav_proposal__row">
            <div class="nav_proposal__row_text">
              Allow manager to keep updating NAV based on these methods
              <span class="nav_proposal__row_note">
                All previous manager permissions related to NAV will be
                revoked.
              </span>
            </div>
            <OnboardingToggle
              v-model="proposal.allowManagerToUpdateNav"
              label="Allow manager to keep updating NAV based on these methods"
            />
          </div>
          <div class="nav_proposal__row">
            <div class="nav_proposal__row_text">
              Collect management fees upon NAV proposal execution
            </div>
            <OnboardingToggle
              v-model="proposal.collectManagementFees"
              label="Collect management fees upon NAV proposal execution"
            />
          </div>
          <div class="nav_proposal__row">
            <div class="nav_proposal__row_text">
              Process withdraws after NAV update
            </div>
            <OnboardingToggle
              v-model="proposal.processWithdraw"
              label="Process withdraws after NAV update"
            />
          </div>
        </div>
      </div>

      <!-- Proposal Description -->
      <div class="nav_proposal__field">
        <span class="nav_proposal__label">
          Proposal description<span class="nav_proposal__star">*</span>
        </span>
        <v-textarea
          v-model="proposal.description"
          placeholder="Type here"
          hide-details
          required
        />
      </div>

      <!-- Proposal Methods -->
      <div class="nav_proposal__field">
        <span class="nav_proposal__label">
          Proposal methods<span class="nav_proposal__star">*</span>
        </span>
        <div class="nav_proposal__methods">
          <button
            type="button"
            class="nav_proposal__disclosure"
            :aria-expanded="isMethodsOpen"
            @click="isMethodsOpen = !isMethodsOpen"
          >
            <Icon
              class="nav_proposal__chevron"
              :class="{ 'nav_proposal__chevron--open': isMethodsOpen }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
            <span class="nav_proposal__counts">
              <span
                v-if="newEntriesCount"
                class="nav_proposal__count nav_proposal__count--new"
              >{{ newEntriesCount }} new</span>
              <span
                v-if="deletedEntriesCount"
                class="nav_proposal__count nav_proposal__count--deleted"
              >{{ deletedEntriesCount }} deleted</span>
              <span
                v-if="!newEntriesCount && !deletedEntriesCount"
                class="nav_proposal__count"
              >No changes</span>
            </span>
            <span class="nav_proposal__disclosure_hint">
              {{ isMethodsOpen ? "Hide methods" : "Show methods" }}
            </span>
          </button>
          <FundNavMethodsTable
            v-if="isMethodsOpen"
            v-model:methods="fundManagedNAVMethods"
            :fund-chain-id="fundStore.selectedFundChain"
            :fund-address="fundStore.fundAddress"
            :fund-contract-base-token-balance="Number(fundStore.fund?.fundContractBaseTokenBalance)"
            :safe-contract-base-token-balance="Number(fundStore.fund?.safeContractBaseTokenBalance)"
            :fee-balance="Number(fundStore.fund?.feeBalance)"
            :safe-address="fundStore.fund?.safeAddress"
            :base-symbol="fundStore.fund?.baseToken.symbol"
            :base-decimals="fundStore.fund?.baseToken.decimals"
            show-base-token-balances
            show-simulated-nav
            show-summary-row
            deletable
            frameless
            idx="proposal"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="nav_proposal__actions">
        <v-btn
          color="primary"
          :disabled="!accountStore.isConnected || !canCreateProposal"
          @click="submitProposal"
        >
          Create proposal
          <v-tooltip
            v-if="!accountStore.isConnected || !canCreateProposal"
            :model-value="true"
            activator="parent"
            location="top"
            @update:model-value="true"
          >
            {{
              accountStore.isConnected
                ? NO_DELEGATES_TITLE
                : "Connect your wallet to create a proposal."
            }}
          </v-tooltip>
        </v-btn>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  encodeUpdateNavMethods,
  getAllowManagerToUpdateNavProposalData,
  getNavMethodsProposalData,
} from "~/composables/nav/navProposal";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import {
  NO_DELEGATES_TITLE,
  useProposalDelegation,
} from "~/composables/governance/useProposalDelegation";
const router = useRouter();
const fundStore = useFundStore();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const { canCreateProposal, assertCanCreateProposal } = useProposalDelegation();
const emit = defineEmits(["updateBreadcrumbs"]);

const {
  selectedFundAddress,
  selectedFundSlug,
  fundManagedNAVMethods,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = storeToRefs(fundStore);

const proposal = ref({
  title: "",
  allowManagerToUpdateNav: false,
  collectManagementFees: false,
  processWithdraw: false,
  description: "",
});
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Manage NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav/manage`,
  },
  {
    title: "Create NAV Proposal",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage/proposal`,
  },
];

const form = ref(null);
const loading = ref(false);
const formIsValid = ref(false);
// The methods list opens on demand; the counts above it say whether there is
// anything to look at.
const isMethodsOpen = ref(false);

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const newEntriesCount = computed(() => {
  return (
    fundManagedNAVMethods.value.filter((method: any) => method.isNew).length ??
    0
  );
});
const deletedEntriesCount = computed(() => {
  return (
    fundManagedNAVMethods.value.filter((method: any) => method.deleted)
      .length ?? 0
  );
});
const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate.value) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
});


/**
 * Creating a new proposal flow:
 * 1) submitProposal()
 *    encodes NAV update entries (encodedNavUpdateEntries)
 * 2) generateNAVPermission to allow manager to keep updating NAV
 *    based on these methods
 *
 *   function propose(
 *     address[] memory targets,
 *     uint256[] memory values,
 *     bytes[] memory calldatas,
 *     string memory description
 *   )
 */
const submitProposal = async () => {
  // Guards the click as well as the button: the delegate read can still be in
  // flight when the form is filled in.
  if (!(await assertCanCreateProposal())) return;

  const encodedNavUpdateEntries = encodeUpdateNavMethods(
    fundManagedNAVMethods.value,
    fundStore.fund?.baseToken.decimals,
    proposal.value.processWithdraw,
  );
  const navMethodsProposal = getNavMethodsProposalData(
    encodedNavUpdateEntries,
    fundStore.fundAddress,
    true,
    proposal.value.collectManagementFees,
    true,
  );

  /**
   * Submit Proposal 1
   * NAV methods
   */
  loading.value = true;
  try {
    await fundStore.fundGovernorContract
      .send(
        "propose",
        {},
        ...[
          navMethodsProposal.targets,
          navMethodsProposal.gasValues,
          navMethodsProposal.calldatas,
          JSON.stringify({
            title: proposal.value.title,
            description: proposal.value.description,
          }),
        ],
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The proposal transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          clearDraft();
          toastStore.successToast(
            "Register the proposal transactions was successful. " +
              "You can now vote on the proposal in the governance page.",
          );
          router.push(`/details/${selectedFundSlug.value}/governance`);
        } else {
          toastStore.errorToast(
            "The register proposal transaction has failed. Please contact the Rethink Finance support.",
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

  /**
   * Submit Proposal 2
   * Allow manager to keep updating NAV based on approved methods
   */
  loading.value = true;
  if (!proposal.value.allowManagerToUpdateNav) return;
  const roleModAddress = await fundStore.fetchRoleModAddress(fundStore.fundAddress);

  const allowManagerToUpdateNavProposal = getAllowManagerToUpdateNavProposalData(
    encodedNavUpdateEntries,
    fundStore.fundAddress,
    fundStore.selectedFundChain,
    roleModAddress,
  );
  // Permissions for non gov NAV updates
  try {
    await fundStore.fundGovernorContract
      .send(
        "propose",
        {},
        ...[
          allowManagerToUpdateNavProposal.targets,
          allowManagerToUpdateNavProposal.gasValues,
          allowManagerToUpdateNavProposal.calldatas,
          JSON.stringify({
            title: "Allow Manager to Keep Updating - " + proposal.value.title,
            description: "Allow Manager to keep updating NAV based on the methods in the " + proposal.value.title + ".\n All previous manager permissions related to NAV will be revoked.",
          }),
        ],
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The proposal transaction has been submitted. Please wait for it to be confirmed.",
        );

        clearDraft();
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          clearDraft();
          toastStore.successToast(
            "Requesting future NAV permissions transactions was successful. " +
              "You can now vote on the proposal in the governance page.",
          );
        } else {
          toastStore.errorToast(
            "The register proposal transaction has failed. Please contact the Rethink Finance support.",
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

watch(
  fundManagedNAVMethods,
  () => {
    saveDraft();
  },
  { deep: true },
);

const clearDraft = async () => {
  try {
    fundManagedNAVMethods.value = JSON.parse(
      JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt),
      parseBigInt,
    );
    // reset the local storage as well
    const navUpdateEntries = await getLocalForageItem("navUpdateEntries");
    // navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    // we need to delete navUpdateEntries[selectedFundAddress.value];
    delete navUpdateEntries[selectedFundAddress.value];

    setLocalForageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear NAV draft");
  }
};

const saveDraft = async () => {
  try {
    const navUpdateEntries = await getLocalForageItem("navUpdateEntries");

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt),
    );

    setLocalForageItem("navUpdateEntries", navUpdateEntries);
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save NAV draft");
  }
};
</script>

<style scoped lang="scss">
.nav_proposal {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 0.4375rem;
  }

  &__title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    color: $color-white;
  }

  &__meta {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  &__label_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__star {
    margin-left: 0.25em;
    color: $color-cyan;
  }

  &__limit {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
  }

  /* The three switches, in the same hairline rows the create flow's
     prepopulated permissions use. */
  &__rows {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 0.75rem 1rem;

    & + & {
      border-top: 1px solid $color-line;
    }
  }

  &__row_text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }

  &__row_note {
    font-size: 12px;
    line-height: 1.5;
    color: $color-warn;
  }

  &__methods {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    overflow: hidden;
  }

  &__disclosure {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: $color-card-background;
    text-align: left;
    cursor: pointer;

    &[aria-expanded="true"] {
      border-bottom: 1px solid $color-line;
    }
  }

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__counts {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__count {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--new {
      color: $color-yield;
    }
    &--deleted {
      color: $color-neg;
    }
  }

  &__disclosure_hint {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (prefers-reduced-motion: reduce) {
    &__chevron {
      transition: none;
    }
  }
}
</style>
