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
                @click="createProposal"
              >
                Create Proposal
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
import RethinkFundGovernor from "assets/contracts/RethinkFundGovernor.json";

const web3Store = useWeb3Store();
const fundStore = useFundStore();
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

const defaultNavEntryPermission = {
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

const updateNavABI = GovernableFund.abi.find(
  func => func.name === "updateNav" && func.type === "function",
);
const collectFeesABI = GovernableFund.abi.find(
  func => func.name === "collectFees" && func.type === "function",
);

const prepNAVMethodLiquid = (details: Record<string, any>): any[] => {
  return details.liquid.map((method: Record<string, any>) => [
    method.tokenPair || "",
    method.aggregatorAddress || "",
    method.functionSignatureWithEncodedInputs || "",
    method.assetTokenAddress || "",
    method.nonAssetTokenAddress || "",
    method.isReturnArray || "",
    parseInt(method.returnLength) || 0,
    parseInt(method.returnIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

const prepNAVMethodIlliquid = (details: Record<string, any>): any[] => {
  return details.illiquid.map((method: Record<string, any>) => {
    const trxHashes = method.otcTxHashes?.map(
      // Remove leading and trailing whitespace
      (hash: string) => hash.trim(),
    ).filter(
      // Remove empty strings;
      (hash: string) => hash !== "",
    ) || [];

    const baseDecimals = fundStore.fund?.baseToken.decimals;
    if (!baseDecimals) {
      toastStore.errorToast("Failed preparing NAV Illiquid method, base decimals are not known.")
      throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
    }

    return [
      ethers.parseUnits(method.baseCurrencySpent?.toString() ?? "0", baseDecimals),
      parseInt(method.amountAquiredTokens) || 0,
      method.tokenAddress,
      method.isNFT,
      trxHashes,
      parseInt(method.nftType) || 0,
      parseInt(method.nftIndex) || 0,
      parseInt(method.pastNAVUpdateIndex) || 0,
    ]
  });
}

const prepNAVMethodNFT = (details: Record<string, any>): any[] => {
  return details.nft.map((method: Record<string, any>) => [
    method.oracleAddress,
    method.nftAddress,
    method.nftType,
    parseInt(method.nftIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

const prepNAVMethodComposable = (details: Record<string, any>): any[] => {
  return details.composable.map((method: Record<string, any>) => [
    method.remoteContractAddress,
    method.functionSignatures,
    method.encodedFunctionSignatureWithInputs,
    parseInt(method.normalizationDecimals) || 0,
    method.isReturnArray,
    parseInt(method.returnValIndex) || 0,
    parseInt(method.returnArraySize) || 0,
    method.returnValType,
    parseInt(method.pastNAVUpdateIndex) || 0,
    method.isNegative,
  ]);
}

const getMethodsPastNAVUpdateIndex = (methods: Record<string, any>[]) => {
  return methods.find(method => "pastNAVUpdateIndex" in method)?.pastNAVUpdateIndex ?? 0;
}

const createProposal = async () => {
  if (!web3Store.web3) return;

  const navUpdateEntries = [];
  const pastNavUpdateEntryAddresses: any[] = [];

  for (const navEntry of fundManagedNAVMethods.value as INAVMethod[]) {
    // Skip deleted entries in the new proposal.
    if (navEntry.deleted) continue;

    const navEntryDetails = JSON.parse(JSON.stringify(navEntry.details));

    if (navEntryDetails.pastNAVUpdateEntryFundAddress) {
      pastNavUpdateEntryAddresses.push(navEntryDetails.pastNAVUpdateEntryFundAddress)
    }

    let pastNAVUpdateIndex = 0;

    if (navEntry.positionType === PositionType.Liquid) {
      navEntryDetails.liquid = prepNAVMethodLiquid(navEntryDetails);
      pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(navEntryDetails[PositionType.Liquid]);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      navEntryDetails.illiquid = prepNAVMethodIlliquid(navEntryDetails);
      pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(navEntryDetails[PositionType.Illiquid]);
    } else if (navEntry.positionType === PositionType.NFT) {
      navEntryDetails.nft = prepNAVMethodNFT(navEntryDetails);
      pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(navEntryDetails[PositionType.NFT]);
    } else if (navEntry.positionType === PositionType.Composable) {
      navEntryDetails.composable = prepNAVMethodComposable(navEntryDetails);
      pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(navEntryDetails[PositionType.Composable]);
    }

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
  console.log("data to encode: ", [
    navUpdateEntries,
    pastNavUpdateEntryAddresses,
    proposal.value.collectManagementFees,
  ])
  const encodedDataNavUpdateEntries = web3Store.web3.eth.abi.encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      navUpdateEntries,
      pastNavUpdateEntryAddresses,
      proposal.value.collectManagementFees,
    ],
  );
  console.log("encodedDataNavUpdateEntries: ", encodedDataNavUpdateEntries)
  console.log("governor: ", fundStore.fund?.governorAddress);
  const rethinkFundGovernorContract = new web3Store.web3.eth.Contract(
    RethinkFundGovernor.abi,
    fundStore.fund?.governorAddress,
  );

  const navUpdateLatestIndex = await fundStore.fundContract.methods._navUpdateLatestIndex().call();
  console.log("Nav update latest index: ", navUpdateLatestIndex);

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
  rethinkFundGovernorContract.methods.propose(
    [
      fundStore.fund?.address,
      fundStore.fund?.address,
      fundStore.fund?.address,
      fundStore.fund?.address,
    ],
    [0,0,0,0],
    [
      encodedDataNavUpdateEntries,
      encodedCollectFlowFeesAbiJSON,
      encodedCollectManagerFeesAbiJSON,
      encodedCollectPerformanceFeesAbiJSON,
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
        "You can now vote on the proposal in the pool governance page.",
      );
    } else {
      toastStore.errorToast(
        "The register proposal transaction has failed. Please contact the Rethink Finance support.",
      );
    }
    loading.value = false;
  }).on("error", function(error){
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
