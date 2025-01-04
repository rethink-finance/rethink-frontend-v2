<template>
  <div>
    <UiHeader>
      <div class="header">
        <div class="main_header__title">
          Create NAV Proposal
        </div>
        <div class="main_header__subtitle">
          Last NAV update date: <strong>{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
    </UiHeader>
    <div class="main_card">
      <v-form ref="form" v-model="formIsValid">
        <v-container fluid>
          <!-- Proposal Title -->
          <v-row>
            <div class="proposal_title_field">
              <v-label class="label_required">
                Proposal Title
              </v-label>
              <div class="proposal_title_field__char_limit">
                <ui-char-limit
                  :char-limit="150"
                  :char-number="proposal.title"
                />
              </div>
            </div>
          </v-row>
          <v-row class="mb-6">
            <v-text-field
              v-model="proposal.title"
              placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
              required
            />
          </v-row>

          <!-- Management -->
          <v-row>
            <v-label class="label_required">
              Management
            </v-label>
          </v-row>
          <v-row class="mb-6">
            <div class="management">
              <div class="management__card">
                <div class="management__row">
                  <div>
                    Allow manager to keep updating NAV based on these methods
                  </div>
                  <v-switch
                    v-model="proposal.allowManagerToUpdateNav"
                    color="primary"
                    hide-details
                  />
                </div>
                <div class="d-inline-block">
                  <div class="management__info">
                    <v-icon color="primary" icon="mdi-alert-circle-outline" />
                    <div>
                      All previous manager permissions related to NAV will be
                      revoked.
                    </div>
                  </div>
                </div>
              </div>
              <div class="management__card">
                <div class="management__row">
                  <div>Collect management fees upon NAV proposal execution</div>
                  <v-switch
                    v-model="proposal.collectManagementFees"
                    color="primary"
                    hide-details
                  />
                </div>
              </div>
              <div class="management__card--no-margin">
                <div class="management__row">
                  <div>Process withdraws after NAV update</div>
                  <v-switch
                    v-model="proposal.processWithdraw"
                    color="primary"
                    hide-details
                  />
                </div>
              </div>
            </div>
          </v-row>

          <!-- Proposal Description -->
          <v-row>
            <v-label class="label_required mb-2">
              Proposal Description
            </v-label>
          </v-row>
          <v-row class="mb-6">
            <v-textarea
              v-model="proposal.description"
              :placeholder="`Type here`"
              hide-details
              required
            />
          </v-row>

          <v-row
            class="proposal_description d-flex flex-grow-1 justify-space-between align-center mb-2"
          >
            <v-label class="label_required">
              Proposal Methods
            </v-label>
          </v-row>
          <v-row class="mb-4">
            <v-expansion-panels>
              <v-expansion-panel eager>
                <v-expansion-panel-title static>
                  <div
                    class="d-flex flex-grow-1 justify-space-between align-center me-4"
                  >
                    <div class="nav_methods_title">
                      <div>•</div>
                      <div v-if="newEntriesCount" class="text-success">
                        {{ newEntriesCount }} New
                      </div>
                      <div v-if="deletedEntriesCount" class="text-error">
                        {{ deletedEntriesCount }} Deleted
                      </div>
                      <div v-if="!newEntriesCount && !deletedEntriesCount">
                        0 Changes
                      </div>
                    </div>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <FundNavMethodsTable
                    v-model:methods="fundManagedNAVMethods"
                    :fund-chain-id="fundStore.fundChainId"
                    :fund-address="fundStore.fundAddress"
                    :fund-contract-base-token-balance="Number(fundStore.fund?.fundContractBaseTokenBalance)"
                    :safe-contract-base-token-balance="Number(fundStore.fund?.safeContractBaseTokenBalance)"
                    :fee-balance="Number(fundStore.fund?.feeBalance)"
                    show-base-token-balances
                    show-simulated-nav
                    show-summary-row
                    deletable
                    idx="proposal"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-row>

          <!-- Action Buttons -->
          <v-row>
            <div class="action_buttons">
              <v-btn
                class="bg-primary text-secondary ms-6"
                :disabled="!accountStore.isConnected"
                @click="submitProposal"
              >
                Create Proposal
                <v-tooltip
                  v-if="!accountStore.isConnected"
                  :model-value="true"
                  activator="parent"
                  location="top"
                  @update:model-value="true"
                >
                  Connect your wallet to create a proposal.
                </v-tooltip>
              </v-btn>
            </div>
          </v-row>
        </v-container>
      </v-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import type { AbiFunctionFragment } from "web3";
import { encodeFunctionCall } from "web3-eth-abi";
import ZodiacRoles from "assets/contracts/zodiac/RolesFull.json";
import { NAVExecutor } from "~/assets/contracts/NAVExecutor";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { generateNAVPermission } from "~/composables/nav/generateNAVPermission";
import {
  encodedCollectFlowFeesAbiJSON,
  encodedCollectManagerFeesAbiJSON,
  encodedCollectPerformanceFeesAbiJSON,
} from "~/composables/nav/encodedCollectFees";
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";
import { encodeUpdateNavMethods } from "~/composables/nav/encodeUpdateNavMethods";
const router = useRouter();
const fundStore = useFundStore();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const emit = defineEmits(["updateBreadcrumbs"]);

const {
  selectedFundAddress,
  selectedFundSlug,
  fundManagedNAVMethods,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = toRefs(fundStore);

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

const storeNAVDataABI = NAVExecutor.abi.find(
  (func: any) => func.name === "storeNAVData" && func.type === "function",
);


const encodeRoleModEntries = async (
  proposalEntries: any[],
): Promise<[any[], any[], any[]]> => {
  loading.value = true;
  const proposalRoleModMethods = ZodiacRoles.abi.filter(
    (val) => val.type === "function",
  );
  const roleModAddress = await fundStore.getRoleModAddress();
  console.log("roleModAddress: ", roleModAddress);

  const encodedRoleModEntries = [];

  const targets = [];
  const gasValues = [];

  for (let i = 0; i < proposalEntries.length; i++) {
    const roleModFunctionABI =
      proposalRoleModMethods[proposalEntries[i].valueMethodIdx];
    console.log(
      "roleModFunctionABI: ",
      JSON.stringify(roleModFunctionABI, null, 2),
    );
    const roleModFunctionData = [];
    for (let j = 0; j < proposalEntries[i].value.length; j++) {
      /*
        {
          "isArray": false,
          "data": "0xe977757dA5fd73Ca3D2bA6b7B544bdF42bb2CBf6",
          "internalType": "address",
          "name": "module"
        },
      */
      roleModFunctionData.push(
        prepRoleModEntryInput(proposalEntries[i].value[j]),
      );
    }
    const encodedRoleModFunction = encodeFunctionCall(
      roleModFunctionABI as AbiFunctionFragment,
      roleModFunctionData,
    );
    console.log(
      "roleModFunctionData: ",
      i,
      JSON.stringify(roleModFunctionData, null, 2),
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0);
  }

  return [encodedRoleModEntries, targets, gasValues];
};

const getProposal1Data = (encodedNavUpdateEntries: any) => {
  // Propose NAV update for fund (target: fund addr, payloadL bytes)
  loading.value = true;
  const targetAddresses = [
    fundStore.fundAddress, // encodedNavUpdateEntries
    fundStore.fundAddress, // encodedCollectFlowFeesAbiJSON
  ];
  const gasValues = [
    0, // encodedNavUpdateEntries
    0, // encodedCollectFlowFeesAbiJSON
  ];
  const calldatas = [encodedNavUpdateEntries, encodedCollectFlowFeesAbiJSON];

  // Conditionally include collect Management fees.
  console.log("collectManagementFees: ", proposal.value.collectManagementFees);
  if (proposal.value.collectManagementFees) {
    targetAddresses.push(fundStore.fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectManagerFeesAbiJSON);
  }

  // Include collect Performance fees.
  targetAddresses.push(fundStore.fundAddress);
  gasValues.push(0);
  calldatas.push(encodedCollectPerformanceFeesAbiJSON);

  console.log(
    "proposal1:",
    JSON.stringify(
      {
        targetAddresses,
        gasValues,
        calldatas,
      },
      null,
      2,
    ),
  );

  return [
    targetAddresses,
    gasValues,
    calldatas,
    JSON.stringify({
      title: proposal.value.title,
      description: proposal.value.description,
    }),
  ];
}


const getProposal2Data = async (
  encodedNavUpdateEntries: any,
  fundAddress: string,
  fundChainId: string,
) => {
  const navExecutorAddress = NAVExecutorBeaconProxyAddress(fundChainId);
  const navPermissionEntries = generateNAVPermission(
    fundAddress,
    navExecutorAddress,
  );
  console.log(
    "navPermission: ",
    JSON.stringify(navPermissionEntries, null, 2),
  );
  const [encodedRoleModEntries, roleModTargets, roleModGasValues] =
    await encodeRoleModEntries(navPermissionEntries);
  const encodedDataStoreNAVDataNavUpdateEntries =
    encodeFunctionCall(
      storeNAVDataABI as AbiFunctionFragment,
      [fundAddress, encodedNavUpdateEntries],
    );

  return [
    [navExecutorAddress].concat(roleModTargets),
    [0].concat(roleModGasValues),
    [encodedDataStoreNAVDataNavUpdateEntries].concat(encodedRoleModEntries),
    JSON.stringify({
      title: "Allow Manager to Keep Updating - " + proposal.value.title,
      description: "Allow Manager to keep updating NAV based on the methods in the " + proposal.value.title + ".\n All previous manager permissions related to NAV will be revoked.",
    }),
  ];
}



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
  const encodedNavUpdateEntries = encodeUpdateNavMethods(
    fundManagedNAVMethods.value,
    fundStore.fund?.baseToken.decimals,
    proposal.value.processWithdraw,
  );
  const proposalData: any = getProposal1Data(encodedNavUpdateEntries);

  /**
   * Submit Proposal 1
   * NAV methods
   */
  loading.value = true;
  try {
    await fundStore.fundGovernorContract
      .send("propose", {}, ...proposalData)
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
  const proposalData2: any = await getProposal2Data(
    encodedNavUpdateEntries,
    fundStore.fundAddress,
    fundStore.selectedFundChain,
  );

  // Permissions for non gov NAV updates
  try {
    await fundStore.fundGovernorContract
      .send("propose", {}, ...proposalData2)
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

const clearDraft = () => {
  try {
    fundManagedNAVMethods.value = JSON.parse(
      JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt),
      parseBigInt,
    );
    // reset the local storage as well
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});
    // navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    // we need to delete navUpdateEntries[selectedFundAddress.value];
    delete navUpdateEntries[selectedFundAddress.value];

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear NAV draft");
  }
};

const saveDraft = () => {
  try {
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt),
    );

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save NAV draft");
  }
};
</script>

<style scoped lang="scss">
.main_header__subtitle {
  color: $color-steel-blue;
  font-weight: 500;
}

.header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.62rem;
  min-height: 40px;
}
.proposal_title_field {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 0.69rem;

  &__char_limit {
    display: flex;
    flex-direction: row;
    color: $color-steel-blue;
    font-size: $text-sm;
    font-weight: 400;
    align-items: center;
    gap: 0.25rem;
  }
}
.management {
  width: 100%;
  display: flex;
  flex-direction: column;
  @include borderGray;
  padding: 0.5rem;
  margin: 0.69rem 0;

  &__card {
    width: 100%;
    padding: 0.88rem 0.5rem;
    border-radius: 0.25rem;
    background: $color-badge-navy;
    margin-bottom: 0.12rem;
    font-size: $text-md;
    font-weight: 400;

    &--no-margin {
      width: 100%;
      padding: 0.88rem 0.5rem;
      border-radius: 0.25rem;
      background: $color-badge-navy;
      font-size: $text-md;
      font-weight: 400;
    }
  }
  &__info {
    @include borderGray;
    display: flex;
    flex-direction: row;
    gap: 0.25rem;
    padding: 0.25rem;
    background-color: $color-background-button;
    color: $color-steel-blue;
    font-weight: 700;
    font-size: $text-sm;
    text-transform: uppercase;
  }
  &__row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.nav_methods_title {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  font-weight: 500;
  font-size: $text-sm;
}

.action_buttons {
  width: 100%;
  display: flex;
  flex-direction: row;
  margin-top: 1rem;
  justify-content: flex-end;
}
</style>
