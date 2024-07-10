<template>
  <div>
    <UiHeader>
      <div class="header">
        <div class="main_header__title">
          Create NAV Proposal
        </div>
        <div class="main_header__subtitle">
          Last updated on <strong>{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
    </UiHeader>
    <div class="main_card">
      <v-form ref="form" v-model="formIsValid">
        <v-container fluid>
          <div class="mb-8">
            <v-row>
              <div class="proposal_title_field">
                <v-label class="label_required">
                  Proposal Title
                </v-label>
                <div class="proposal_title_field__char_limit">
                  <v-label>
                    MAX 150
                  </v-label>
                  <v-icon icon="mdi-circle-outline" size="15" />
                </div>
              </div>
            </v-row>
            <v-row>
              <v-text-field
                v-model="proposal.title"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                required
              />
            </v-row>
          </div>
          <v-row>
            <v-label class="label_required">
              Management
            </v-label>
          </v-row>
          <v-row>
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
                    inset
                  />
                </div>
                <div class="d-inline-block">
                  <div class="management__info">
                    <v-icon color="primary" icon="mdi-alert-circle-outline" />
                    <div>
                      All previous manager permissions related to NAV will be revoked.
                    </div>
                  </div>
                </div>
              </div>
              <div class="management__card--no-margin">
                <div class="management__row">
                  <div>
                    Collect management fees upon NAV proposal execution
                  </div>
                  <v-switch
                    v-model="proposal.collectManagementFees"
                    color="primary"
                    hide-details
                    inset
                  />
                </div>
              </div>
            </div>
          </v-row>
          <v-row>
            <v-label class="label_required proposal_description">
              Proposal Description
            </v-label>
          </v-row>
          <v-textarea
            v-model="proposal.description"
            :placeholder="`Type here`"
            hide-details
            required
          />

          <v-row class="nav_method_changes">
            <v-expansion-panels>
              <v-expansion-panel eager>
                <v-expansion-panel-title static>
                  <div class="nav_method_changes__title">
                    <div>
                      Proposal Methods
                    </div>
                    <div>
                      •
                    </div>
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
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <FundNavMethodsTable v-model:methods="fundManagedNAVMethods" deletable />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-row>

          <v-row>
            <div class="action-buttons">
              <v-btn
                class="text-secondary"
                variant="outlined"
                :disabled="true"
              >
                Save Draft
              </v-btn>
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
import { ethers } from "ethers";
import type { AbiFunctionFragment } from "web3";
import { useFundStore } from "~/store/fund.store";
import { PositionType } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { useWeb3Store } from "~/store/web3.store";
import GovernableFund from "assets/contracts/GovernableFund.json";
import { useToastStore } from "~/store/toast.store";
import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import { useAccountStore } from "~/store/account.store";

const web3Store = useWeb3Store();
const fundStore = useFundStore();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const emit = defineEmits(["updateBreadcrumbs"]);

const { selectedFundSlug, fundManagedNAVMethods, fundLastNAVUpdate } = toRefs(fundStore);
const proposal = ref({
  title: "",
  allowManagerToUpdateNav: false,
  collectManagementFees: false,
  description: "",
})
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
  return fundManagedNAVMethods.value.filter(method => method.isNew).length ?? 0;
});
const deletedEntriesCount = computed(() => {
  return fundManagedNAVMethods.value.filter(method => method.deleted).length ?? 0;
});
const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate.value) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
})

const updateNavABI = GovernableFund.abi.find(
  func => func.name === "updateNav" && func.type === "function",
);
const collectFeesABI = GovernableFund.abi.find(
  func => func.name === "collectFees" && func.type === "function",
);


const getMethodsPastNAVUpdateIndex = (methods: Record<string, any>[]) => {
  return methods.find(method => "pastNAVUpdateIndex" in method)?.pastNAVUpdateIndex ?? 0;
}

/**
 * Creating a new proposal flow:
 * 1) createProposal()
 *    encodes NAV update entries (encodedNavUpdateEntries)
 * 2) generateNAVPermission(encodedNavUpdateEntries)
 *    these encoded NAV update entires are passed to: generateNAVPermission(encodedNavUpdateEntries) which
 *    generates a NAV permission.
 * 3)
 */
const generateNAVPermission = (encodedNavUpdateEntries: string) =>  {
  // Default NAV entry permission
  const navEntryPermission: Record<string, any> = {
    "idx": 0,
    "value": [
      {
        "idx": 0,
        "isArray": false,
        "data": "1",
        "internalType": "uint16",
        "name": "role",
      },
      {
        "idx": 1,
        "isArray": false,
        "data": null,
        "internalType": "address",
        "name": "targetAddress",
      },
      {
        "idx": 2,
        "isArray": false,
        "data": null,
        "internalType": "bytes4",
        "name": "functionSig",
      },
      {
        "idx": 3,
        "isArray": true,
        "data": [],
        "internalType": "bool[]",
        "name": "isParamScoped",
      },
      {
        "idx": 4,
        "isArray": true,
        "data": [],
        "internalType": "enum ParameterType[]",
        "name": "paramType",
      },
      {
        "idx": 5,
        "isArray": true,
        "data": [],
        "internalType": "enum Comparison[]",
        "name": "paramComp",
      },
      {
        "idx": 6,
        "isArray": true,
        "data": [],
        "internalType": "bytes[]",
        "name": "compValue",
      },
      {
        "idx": 7,
        "isArray": false,
        "data": "1",
        "internalType": "enum ExecutionOptions",
        "name": "options",
      },
    ],
    "valueMethodIdx": 19,
  }

  // Target address is fund contract
  navEntryPermission.value[1].data = fundStore.fund?.address;
  // functionSig
  navEntryPermission.value[2].data = encodedNavUpdateEntries.substring(0,10);
  // Raw data to permission
  const subNAVEntriesEncoded = encodedNavUpdateEntries.substring(10);
  const n = 64;
  const navWords = [];
  const navIsScoped = [];
  const navTypeNComp = [];
  for (let sidx = 0; sidx < subNAVEntriesEncoded.length; sidx += n) {
    navWords.push(
      "0x" + subNAVEntriesEncoded.substring(sidx,sidx+n),
    );
    navIsScoped.push("true");
    navTypeNComp.push("0");
  }

  // isParamScoped
  navEntryPermission.value[3].data = navIsScoped;
  // paramType
  navEntryPermission.value[4].data = navTypeNComp;
  // paramComp
  navEntryPermission.value[5].data = navTypeNComp;
  // compValue
  navEntryPermission.value[6].data = navWords;

  return [navEntryPermission];
}

const encodeRoleModEntries = async (proposalEntries: any[]): Promise<[any[], any[], any[]]> => {
  if (!web3Store.web3) return [[], [], []];

  loading.value = true;
  const proposalRoleModMethods = ZodiacRoles.abi.filter((val) => (val.type === "function"));
  const roleModAddress = await fundStore.getRoleModAddress();
  console.log("roleModAddress: ", roleModAddress);

  const encodedRoleModEntries = [];

  const targets = [];
  const gasValues = [];

  for(let i = 0; i < proposalEntries.length; i++) {
    const roleModFunctionABI = proposalRoleModMethods[proposalEntries[i].valueMethodIdx];
    console.log("roleModFunctionABI: ", JSON.stringify(roleModFunctionABI, null, 2))
    const roleModFunctionData = [];
    for (let j = 0; j< proposalEntries[i].value.length; j++) {
      /*
        {
          "idx": 0,
          "isArray": false,
          "data": "0xe977757dA5fd73Ca3D2bA6b7B544bdF42bb2CBf6",
          "internalType": "address",
          "name": "module"
        },
      */
      roleModFunctionData.push(prepRoleModEntryInput(proposalEntries[i].value[j]));
    }
    const encodedRoleModFunction = web3Store.web3.eth.abi.encodeFunctionCall(
      roleModFunctionABI as AbiFunctionFragment,
      roleModFunctionData,
    );
    console.log("roleModFunctionData: ", i,  JSON.stringify(roleModFunctionData, null, 2))
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0)
  }

  return [encodedRoleModEntries, targets, gasValues]
}

const createProposal = async () => {
  if (!web3Store.web3) return;

  const navUpdateEntries = [];
  const pastNavUpdateEntryAddresses: any[] = [];

  for (const navEntry of fundManagedNAVMethods.value as INAVMethod[]) {
    // Skip deleted entries in the new proposal.
    if (navEntry.deleted) continue;

    const navEntryDetails = JSON.parse(JSON.stringify(navEntry.details));

    if (navEntry.pastNAVUpdateEntryFundAddress) {
      pastNavUpdateEntryAddresses.push(navEntry.pastNAVUpdateEntryFundAddress)
    }

    let pastNAVUpdateIndex = 0;

    const baseDecimals = fundStore.fund?.baseToken.decimals;
    if (!baseDecimals) {
      toastStore.errorToast("Failed preparing NAV Illiquid method, fund base token decimals are not known.")
      throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
    }

    if (navEntry.positionType === PositionType.Liquid) {
      navEntryDetails.liquid = prepNAVMethodLiquid(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      navEntryDetails.illiquid = prepNAVMethodIlliquid(navEntryDetails, baseDecimals);
    } else if (navEntry.positionType === PositionType.NFT) {
      navEntryDetails.nft = prepNAVMethodNFT(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Composable) {
      navEntryDetails.composable = prepNAVMethodComposable(navEntryDetails);
    }

    pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(navEntryDetails[navEntry.positionType]);

    navUpdateEntries.push(
      [
        parseInt(navEntryDetails.entryType),
        toRaw(navEntryDetails.liquid),
        toRaw(navEntryDetails.illiquid),
        toRaw(navEntryDetails.nft),
        toRaw(navEntryDetails.composable),
        navEntryDetails.isPastNAVUpdate,
        pastNAVUpdateIndex,
        parseInt(navEntryDetails.pastNAVUpdateEntryIndex),
        JSON.stringify(navEntryDetails.description),
      ],
    )
  }
  console.log("navUpdateEntries: ", navUpdateEntries);
  console.log("pastNavUpdateEntryAddresses: ", pastNavUpdateEntryAddresses);
  console.log("collectManagementFees: ", proposal.value.collectManagementFees);
  const encodedNavUpdateEntries = web3Store.web3.eth.abi.encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      navUpdateEntries,
      pastNavUpdateEntryAddresses,
      proposal.value.collectManagementFees,
    ],
  );
  console.log("encodedNavUpdateEntries: ", encodedNavUpdateEntries)

  let encodedRoleModEntries = [];
  let roleModTargets = [];
  let roleModGasValues = [];
  if (proposal.value.allowManagerToUpdateNav) {
    const navPermissionEntries = generateNAVPermission(encodedNavUpdateEntries);
    console.log("navPermission: ", JSON.stringify(navPermissionEntries, null, 2));
    [encodedRoleModEntries, roleModTargets, roleModGasValues] = await encodeRoleModEntries(navPermissionEntries);
    console.log("encodedRoleModEntries: ", encodedRoleModEntries);
    console.log("roleModTargets: ", roleModTargets);
    console.log("roleModGasValues: ", roleModGasValues);
  }

  /*
  function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
  )
  */
  const encodedCollectFlowFeesAbiJSON = web3Store.web3.eth.abi.encodeFunctionCall(
    collectFeesABI as AbiFunctionFragment, [0],
  );
  const encodedCollectManagerFeesAbiJSON = web3Store.web3.eth.abi.encodeFunctionCall(
    collectFeesABI as AbiFunctionFragment, [2],
  );
  const encodedCollectPerformanceFeesAbiJSON = web3Store.web3.eth.abi.encodeFunctionCall(
    collectFeesABI as AbiFunctionFragment, [3],
  );

  // Propose NAV update for fund (target: fund addr, payloadL bytes)
  console.log("Active Account: ", fundStore.activeAccountAddress)
  loading.value = true;

  // ADD encoded entries for OIV permissions
  fundStore.fundGovernorContract.methods.propose(
    [
      fundStore.fund?.address,
      fundStore.fund?.address,
      fundStore.fund?.address,
      fundStore.fund?.address,
      ...roleModTargets,
    ],
    [0,0,0,0, ...roleModGasValues],
    [
      encodedNavUpdateEntries,
      encodedCollectFlowFeesAbiJSON,
      encodedCollectManagerFeesAbiJSON,
      encodedCollectPerformanceFeesAbiJSON,
      ...encodedRoleModEntries,
    ],
    JSON.stringify({
      title: proposal.value.title,
      description: proposal.value.description,
    }),
  ).send({
    from: fundStore.activeAccountAddress,
    maxPriorityFeePerGas: undefined,
    maxFeePerGas: undefined,
  }).on("transactionHash", (hash: string) => {
    console.log("tx hash: " + hash);
    toastStore.addToast("The proposal transaction has been submitted. Please wait for it to be confirmed.");
  }).on("receipt", (receipt: any) => {
    console.log("receipt: ", receipt);
    if (receipt.status) {
      toastStore.successToast(
        "Register the proposal transactions was successful. " +
        "You can now vote on the proposal in the governance page.",
      );
    } else {
      toastStore.errorToast(
        "The register proposal transaction has failed. Please contact the Rethink Finance support.",
      );
    }
    loading.value = false;
  }).on("error", (error: any) => {
    console.error(error);
    loading.value = false;
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
  });
}

</script>

<style scoped lang="scss">
.main_header__subtitle {
  color: $color-subtitle;
  font-weight: 500;
}

.header {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: .62rem;
}
.proposal_title_field {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: .69rem;

  &__char_limit {
    display: flex;
    flex-direction: row;
    color: $color-subtitle;
    font-size: $text-sm;
    font-weight: 400;
    align-items: center;
    gap: .25rem;
  }
}
.management {
  width: 100%;
  display: flex;
  flex-direction: column;
  @include borderGray;
  padding: .5rem;
  margin: .69rem 0;

  &__card {
    width: 100%;
    padding: .88rem .5rem;
    border-radius: 0.25rem;
    background: $color-badge-navy;
    margin-bottom: .12rem;
    font-size: $text-md;
    font-weight: 400;

    &--no-margin {
      width: 100%;
      padding: .88rem .5rem;
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
    gap: .25rem;
    padding: .25rem;
    background-color: $color-background-button;
    color: $color-subtitle;
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

.proposal_description {
  margin-top: 2.25rem;
  margin-bottom: 1.5rem;
}

.nav_method_changes {
  margin: 2rem 0;

  &__title {
    display: flex;
    flex-direction: row;
    gap: .5rem;
    font-weight: 500;
    font-size: $text-sm;
  }
}

.action-buttons {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: end;
}
</style>
