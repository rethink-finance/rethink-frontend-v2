<template>
  <div>
    <UiHeader>
      <div class="header">
        <div class="main_header__title">
          Create NAV Proposal
        </div>
        <div class="last-update">
          Last Updates on 22 04 24
        </div>
      </div>
    </UiHeader>
    <div class="main_card">
      <v-form ref="form" v-model="formIsValid">
        <v-container fluid>
          <div class="section">
            <v-row>
              <div class="form-col">
                <v-label class="label_required">
                  Proposal Title
                </v-label>
                <div class="sub-text">
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
              <div class="management__card-no-margin">
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
            <v-label class="label_required proposal">
              Proposal Description
            </v-label>
          </v-row>
          <v-textarea
            v-model="proposal.description"
            :placeholder="`Type here`"
            hide-details
            required
          />

          <v-row class="changes">
            <v-expansion-panels>
              <v-expansion-panel eager>
                <v-expansion-panel-title static>
                  <div class="changes__title">
                    <div>
                      Proposal Methods
                    </div>
                    <!-- TODO implement NAV Proposal changes (additions & deletions count) on proposal methods -->
                    <!--                    <div>-->
                    <!--                      •-->
                    <!--                    </div>-->
                    <!--                    <div class="text-success">-->
                    <!--                      3-->
                    <!--                    </div>-->
                    <!--                    <div>-->
                    <!--                      Changes-->
                    <!--                    </div>-->
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <FundNavMethodsTable v-model:methods="fundManagedNAVMethods" deletable />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-row>

          <v-row>
            <div>
              {{ navEntriesJson }}
            </div>
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
import { ValuationType } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { useWeb3Store } from "~/store/web3.store";
import GovernableFund from "assets/contracts/GovernableFund.json";
import { useToastStore } from "~/store/toast.store";

const web3Store = useWeb3Store();
const fundStore = useFundStore();
const toastStore = useToastStore();
const emit = defineEmits(["updateBreadcrumbs"]);

const { selectedFundSlug, fundManagedNAVMethods } = toRefs(fundStore);
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
const formIsValid = ref(false);

const method = ref<INAVMethod>({
  positionName: "",
  valuationSource: "",
  positionType: PositionType.Liquid,
  valuationType: ValuationType.DEXPair,
  details: [
    {},
  ],
  detailsJson: "[]",
});

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});

const navEntriesJson = computed(() => {
  console.log(fundManagedNAVMethods);
  return "";
});

const data = {
  NAVNFTType: {
    "ERC1155": 0,
    "ERC721": 1,
    "NONE": 2,
  } as Record<string, number>,
  NAVComposableUpdateReturnType: {
    "UINT256": 0,
    "INT256": 1,
  } as Record<string, number>,
  NavUpdateType: {
    "NAVLiquidUpdateType": 0,
    "NAVIlliquidUpdateType": 1,
    "NAVNFTUpdateType": 2,
    "NAVComposableUpdateType": 3,
  } as Record<string, number>,
  defaultNavEntryPermission: {
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
  },
}

const updateNavABI = GovernableFund.abi.find(
  func => func.name === "updateNav" && func.type === "function",
);
const collectFeesABI = GovernableFund.abi.find(
  func => func.name === "collectFees" && func.type === "function",
);
const getNavEntryFunctionABI = GovernableFund.abi.find(
  func => func.name === "getNavEntry" && func.type === "function",
);
console.log("updateNavABI: ", updateNavABI);
console.log("collectFeesABI: ", collectFeesABI);
console.log("getNavEntryFunctionABI: ", getNavEntryFunctionABI);

const prepNAVMethodLiquid = (details: Record<string, any>): any[] => {
  return [
    details.tokenPair || "",
    details.aggregatorAddress || "",
    details.functionSignatureWithEncodedInputs || "",
    details.assetTokenAddress || "",
    details.nonAssetTokenAddress || "",
    details.isReturnArray || "",
    parseInt(details.returnLength) || 0,
    parseInt(details.returnIndex) || 0,
    parseInt(details.pastNAVUpdateIndex) || 0,
  ];
}

const prepNAVMethodNFT = (details: Record<string, any>): any[] => {
  return [
    details.oracleAddress,
    details.nftAddress,
    details.nftType,
    parseInt(details.nftIndex) || 0,
    parseInt(details.pastNAVUpdateIndex) || 0,
  ];
}
const prepNAVMethodComposable = (details: Record<string, any>): any[] => {
  return [
    details.remoteContractAddress,
    details.functionSignatures,
    details.encodedFunctionSignatureWithInputs,
    parseInt(details.normalizationDecimals) || 0,
    details.isReturnArray,
    parseInt(details.returnValIndex) || 0,
    parseInt(details.returnArraySize) || 0,
    details.returnValType,
    parseInt(details.pastNAVUpdateIndex) || 0,
    details.isNegative,
  ];
}
const prepNAVMethodIlliquid = (details: Record<string, any>): any[] => {
  console.log("prepNAV Illiquid: ", details);
  const trxHashes = details.otcTxHashes?.map(
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

  console.log("details.nftType: ", details.nftType);
  console.log("baseCurrencySpent: ", details.baseCurrencySpent);
  return [
    ethers.parseUnits(details.baseCurrencySpent?.toString() ?? "0", baseDecimals),
    parseInt(details.amountAquiredTokens || "0"),
    details.tokenAddress,
    details.isNFT,
    trxHashes,
    details.nftType,
    parseInt(details.nftIndex) || 0,
    parseInt(details.pastNAVUpdateIndex) || 0,
  ];
}

const createProposal = () => {
  if (!web3Store.web3) return;
  /*
  let addLiquidUpdateAbiJSON = component.getFundAbi[8];
  let addIlliquidUpdateAbiJSON = component.getFundAbi[33];
  let addNftUpdateAbiJSON = component.getFundAbi[32];
  let addComposableUpdateAbiJSON = component.getFundAbi[32];
  */
  // const dataNavUpdateEntries = [];
  const dataPastNavUpdateEntriesAddrs: any[] = [];
  const liquidMethods = [];
  const illiquidMethods = [];
  const nftMethods = [];
  const composableMethods = [];

  // const parameters = [
  //   PositionTypeToEntryTypeMap[navUpdate.entryType],
  //   NAVLiquidUpdate[],
  //   NAVIlliquidUpdate[],
  //   NAVNFTUpdate[],
  //   NAVComposableUpdate[],
  //   navUpdate.isPastNAVUpdate,
  //   navUpdate.pastNAVUpdateIndex,
  //   navUpdate.pastNAVUpdateEntryIndex,
  //   JSON.stringify(navUpdate.description),// fundMetadata
  // ];
  for(const navMethod of fundManagedNAVMethods.value as INAVMethod[]) {
    if (navMethod.positionType === PositionType.Liquid) {
      liquidMethods.push(prepNAVMethodLiquid(navMethod.details))
    } else if (navMethod.positionType === PositionType.Illiquid) {
      illiquidMethods.push(prepNAVMethodIlliquid(navMethod.details))
    } else if (navMethod.positionType === PositionType.NFT) {
      nftMethods.push(prepNAVMethodNFT(navMethod.details))
    } else if (navMethod.positionType === PositionType.Composable) {
      composableMethods.push(prepNAVMethodComposable(navMethod.details))
    }
    console.log("navMethod: ", navMethod);

    // For now composable can have more than 1 method, so we store it as array.
    const detailsList = Array.isArray(navMethod.details) ? navMethod.details : [navMethod.details];

    // TODO figure this out
    // for (const details of navMethod.details) {
    //   if (!details?.pastNAVUpdateEntryFundAddress) continue;
    //   dataPastNavUpdateEntriesAddrs.push(
    //     details.pastNAVUpdateEntryFundAddress,
    //   );
    // }
  }
  console.log("methods parsed")
  // TODO WIP
  const parameters = [
    0, // PositionTypeToEntryTypeMap[navUpdate.entryType] // TODO what to use here?
    liquidMethods,
    illiquidMethods,
    nftMethods,
    composableMethods,
    false, // navUpdate.isPastNAVUpdate,
    0, // navUpdate.pastNAVUpdateIndex, // TODO get the last one of the NAV updates?
    0, // navUpdate.pastNAVUpdateEntryIndex,  // TODO what is this?
    JSON.stringify({}),// fundMetadata, navUpdate.description, TODO what to use here? or proposal.description
  ];
  console.log("parameters: ", parameters);

  // console.log(JSON.stringify(dataNavUpdateEntries));
  console.log(updateNavABI);
  const processWithdraw = false;
  const encodedDataNavUpdateEntries = web3Store.web3.eth.abi.encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      [parameters], // dataNavUpdateEntries,
      dataPastNavUpdateEntriesAddrs,
      processWithdraw,
    ]);
  console.log("encodedDataNavUpdateEntries: ", encodedDataNavUpdateEntries)
  //
  // console.log(component.fund.governor);
  // console.log(component.getSelectedFundAddress);
  // console.log(component.getActiveAccount);
  //
  // const rethinkFundGovernorContract = new component.getWeb3.eth.Contract(
  //   RethinkFundGovernorJSON.abi,
  //   component.fund.governor,
  // );
  //
  // const navUpdateIndex = await component.getFundContract.methods._navUpdateLatestIndex().call();

  /*

    function propose(
      address[] memory targets,
      uint256[] memory values,
      bytes[] memory calldatas,
      string memory description
  )
    */

  // const encodedCollectFlowFeesAbiJSON = web3Store.web3.eth.abi.encodeFunctionCall(collectFeesAbiJSON, [0]);
  // const encodedCollectManagerFeesAbiJSON = web3Store.web3.getWeb3.eth.abi.encodeFunctionCall(collectFeesAbiJSON, [2]);
  // const encodedCollectPerformanceFeesAbiJSON = web3Store.web3.getWeb3.eth.abi.encodeFunctionCall(collectFeesAbiJSON, [3]);
}

</script>

<style scoped lang="scss">
.last-update {
  color: $color-subtitle;
  font-weight: 500;
  font-size: $text-sm;
}

.header {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: .62rem;
}
.form-col {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: .69rem;
}
.sub-text {
  display: flex;
  flex-direction: row;
  color: $color-subtitle;
  font-size: $text-sm;
  font-weight: 400;
  align-items: center;
  gap: .25rem;
}
.section {
  margin-bottom: 3em;
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
  }
  &__card-no-margin {
    width: 100%;
    padding: .88rem .5rem;
    border-radius: 0.25rem;
    background: $color-badge-navy;
    font-size: $text-md;
    font-weight: 400;
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

.proposal {
  margin-top: 2.25rem;
  margin-bottom: 1.5rem;
}

.changes {
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
