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
                @click="createProposal"
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
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { NAVExecutor } from "~/assets/contracts/NAVExecutor";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { PositionType } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
const router = useRouter();
const web3Store = useWeb3Store();
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

const updateNavABI = GovernableFund.abi.find(
  (func: any) => func.name === "updateNav" && func.type === "function",
);
const collectFeesABI = GovernableFund.abi.find(
  (func: any) => func.name === "collectFees" && func.type === "function",
);

const storeNAVDataABI = NAVExecutor.abi.find(
  (func: any) => func.name === "storeNAVData" && func.type === "function",
);

const getMethodsPastNAVUpdateIndex = (methods: Record<string, any>[]) => {
  return (
    methods.find((method) => "pastNAVUpdateIndex" in method)
      ?.pastNAVUpdateIndex ?? 0
  );
};

/**
 * Creating a new proposal flow:
 * 1) createProposal()
 *    encodes NAV update entries (encodedNavUpdateEntries)
 * 2) generateNAVPermission(encodedNavUpdateEntries)
 *    these encoded NAV update entires are passed to: generateNAVPermission(encodedNavUpdateEntries) which
 *    generates a NAV permission.
 * 3)
 */
const generateNAVPermission = () => {
  // Default NAV entry permission
  const navEntryPermission: Record<string, any> = {
    value: [
      {
        isArray: false,
        data: "1",
        internalType: "uint16",
        name: "role",
      },
      {
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
      {
        isArray: false,
        data: null,
        internalType: "bytes4",
        name: "functionSig",
      },
      {
        isArray: true,
        data: [],
        internalType: "bool[]",
        name: "isParamScoped",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum ParameterType[]",
        name: "paramType",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum Comparison[]",
        name: "paramComp",
      },
      {
        isArray: true,
        data: [],
        internalType: "bytes[]",
        name: "compValue",
      },
      {
        isArray: false,
        data: "1",
        internalType: "enum ExecutionOptions",
        name: "options",
      },
    ],
    valueMethodIdx: 19,
  };

  const recalcNavEntryPermission: Record<string, any> = {
    value: [
      {
        idx: 0,
        isArray: false,
        data: "1", // TODO: ASSUMES ROLE ID OF 1, BUT COULD BE ANY OTHER ID, NEED A WAY TO POPULATE IT SMARTLY
        internalType: "uint16",
        name: "role",
      },
      {
        idx: 1,
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
    ],
    valueMethodIdx: 24,
  };

  // Target address is fund contract
  navEntryPermission.value[1].data = fundStore.fund?.address;
  // again, need to set target addr for scope target
  recalcNavEntryPermission.value[1].data = fundStore.fund?.address;

  // functionSig
  navEntryPermission.value[2].data = "0xa61f5814";
  const navExecutorAddr = web3Store.NAVExecutorBeaconProxyAddress;
  console.log(navExecutorAddr);
  const navWords = ["0x000000000000000000000000" + navExecutorAddr.slice(2)];
  const navIsScoped = [true];
  const navTypeNComp = ["0"];

  // isParamScoped
  navEntryPermission.value[3].data = navIsScoped;
  // paramType
  navEntryPermission.value[4].data = navTypeNComp;
  // paramComp
  navEntryPermission.value[5].data = navTypeNComp;
  // compValue
  navEntryPermission.value[6].data = navWords;

  return [navEntryPermission, recalcNavEntryPermission];
};

const encodeRoleModEntries = async (
  proposalEntries: any[],
): Promise<[any[], any[], any[]]> => {
  if (!web3Store.web3) return [[], [], []];

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

const createProposal = async () => {
  if (!web3Store.web3) return;

  const navUpdateEntries = [];
  const pastNavUpdateEntryAddresses: any[] = [];

  for (const navEntry of fundManagedNAVMethods.value as INAVMethod[]) {
    // Skip deleted entries in the new proposal.
    if (navEntry.deleted) continue;

    const navEntryDetails = JSON.parse(JSON.stringify(navEntry.details));

    if (navEntry.pastNAVUpdateEntryFundAddress) {
      pastNavUpdateEntryAddresses.push(navEntry.pastNAVUpdateEntryFundAddress);
    }

    let pastNAVUpdateIndex = 0;

    const baseDecimals = fundStore.fund?.baseToken.decimals;
    if (!baseDecimals) {
      toastStore.errorToast(
        "Failed preparing NAV Illiquid method, fund base token decimals are not known.",
      );
      throw new Error(
        "Failed preparing NAV Illiquid method, base decimals are not known.",
      );
    }

    if (navEntry.positionType === PositionType.Liquid) {
      navEntryDetails.liquid = prepNAVMethodLiquid(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      navEntryDetails.illiquid = prepNAVMethodIlliquid(
        navEntryDetails,
        baseDecimals,
      );
    } else if (navEntry.positionType === PositionType.NFT) {
      navEntryDetails.nft = prepNAVMethodNFT(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Composable) {
      navEntryDetails.composable = prepNAVMethodComposable(navEntryDetails);
    }

    pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(
      navEntryDetails[navEntry.positionType],
    );
    // Stringify description, if it is not yet stringified.
    let descriptionJsonString = navEntryDetails.description;
    if (
      typeof descriptionJsonString === "object" &&
      descriptionJsonString !== null
    ) {
      descriptionJsonString = JSON.stringify(navEntryDetails.description);
    }
    navUpdateEntries.push([
      parseInt(navEntryDetails.entryType),
      toRaw(navEntryDetails.liquid),
      toRaw(navEntryDetails.illiquid),
      toRaw(navEntryDetails.nft),
      toRaw(navEntryDetails.composable),
      navEntryDetails.isPastNAVUpdate,
      pastNAVUpdateIndex,
      parseInt(navEntryDetails.pastNAVUpdateEntryIndex),
      descriptionJsonString,
    ]);
  }
  console.log("navUpdateEntries: ", navUpdateEntries);
  console.log("pastNavUpdateEntryAddresses: ", pastNavUpdateEntryAddresses);
  console.log("collectManagementFees: ", proposal.value.collectManagementFees);
  console.log("processWithdraw: ", proposal.value.processWithdraw);
  const encodedNavUpdateEntries = encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      navUpdateEntries,
      pastNavUpdateEntryAddresses,
      proposal.value.processWithdraw,
    ],
  );
  console.log("encodedNavUpdateEntries: ", encodedNavUpdateEntries);

  let encodedRoleModEntries = [];
  let roleModTargets = [];
  let roleModGasValues = [];
  if (proposal.value.allowManagerToUpdateNav) {
    const navPermissionEntries = generateNAVPermission();
    console.log(
      "navPermission: ",
      JSON.stringify(navPermissionEntries, null, 2),
    );
    [encodedRoleModEntries, roleModTargets, roleModGasValues] =
      await encodeRoleModEntries(navPermissionEntries);
    console.log("encodedRoleModEntries: ", encodedRoleModEntries);
    console.log("roleModTargets: ", roleModTargets);
    console.log("roleModGasValues: ", roleModGasValues);
  }
  const encodedDataStoreNAVDataNavUpdateEntries =
    encodeFunctionCall(
      storeNAVDataABI as AbiFunctionFragment,
      [fundStore.fund?.address, encodedNavUpdateEntries],
    );
  const navExecutorAddr = web3Store.NAVExecutorBeaconProxyAddress;

  /*
  function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
  )
  */
  const encodedCollectFlowFeesAbiJSON =
    encodeFunctionCall(
      collectFeesABI as AbiFunctionFragment,
      [0],
    );
  const encodedCollectManagerFeesAbiJSON =
    encodeFunctionCall(
      collectFeesABI as AbiFunctionFragment,
      [2],
    );
  const encodedCollectPerformanceFeesAbiJSON =
    encodeFunctionCall(
      collectFeesABI as AbiFunctionFragment,
      [3],
    );

  // Propose NAV update for fund (target: fund addr, payloadL bytes)
  console.log("Active Account: ", fundStore.activeAccountAddress);
  loading.value = true;
  const targetAddresses = [
    fundStore.fund?.address, // encodedNavUpdateEntries
    fundStore.fund?.address, // encodedCollectFlowFeesAbiJSON
  ];
  const gasValues = [
    0, // encodedNavUpdateEntries
    0, // encodedCollectFlowFeesAbiJSON
  ];
  const calldatas = [encodedNavUpdateEntries, encodedCollectFlowFeesAbiJSON];

  // Conditionally include collect Management fees.
  if (proposal.value.collectManagementFees) {
    targetAddresses.push(fundStore.fund?.address);
    gasValues.push(0);
    calldatas.push(encodedCollectManagerFeesAbiJSON);
  }

  targetAddresses.push(
    ...[
      fundStore.fund?.address, // encodedCollectPerformanceFeesAbiJSON
    ],
  );
  gasValues.push(
    ...[
      0, // encodedCollectPerformanceFeesAbiJSON
    ],
  );
  calldatas.push(...[encodedCollectPerformanceFeesAbiJSON]);
  console.log(
    "proposal:",
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

  const proposalData = [
    targetAddresses,
    gasValues,
    calldatas,
    JSON.stringify({
      title: proposal.value.title,
      description: proposal.value.description,
    }),
  ];

  // ADD encoded entries for OIV permissions
  try {
    await fundStore.fundGovernorContract.methods
      .propose(...proposalData)
      .send({
        from: fundStore.activeAccountAddress,
        gasPrice: "",
      })
      .on("transactionHash", (hash: string) => {
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

  const proposalData2 = [
    [navExecutorAddr].concat(roleModTargets),
    [0].concat(roleModGasValues),
    [encodedDataStoreNAVDataNavUpdateEntries].concat(encodedRoleModEntries),
    JSON.stringify({
      title: proposal.value.title,
      description: proposal.value.description,
    }),
  ];

  // Permissions for non gov nav updates
  try {
    await fundStore.fundGovernorContract.methods
      .propose(...proposalData2)
      .send({
        from: fundStore.activeAccountAddress,
        gasPrice: "",
      })
      .on("transactionHash", (hash: string) => {
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

/**
const saveProposalDraft = () => {
  try {
    const fundProposalDrafts = getLocalStorageItem("fundProposalDrafts", {});

    if (!fundProposalDrafts[selectedFundAddress.value]) {
      fundProposalDrafts[selectedFundAddress.value] = {};
    }

    fundProposalDrafts[selectedFundAddress.value].nav = JSON.parse(
      JSON.stringify(proposal.value, stringifyBigInt),
    );
    setLocalStorageItem("fundProposalDrafts", fundProposalDrafts);
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save fund proposal draft");
  }
};
 */
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
