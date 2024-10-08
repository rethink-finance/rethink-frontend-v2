import defaultAvatar from "@/assets/images/default_avatar.webp";
import { FixedNumber } from "ethers";
import { defineStore } from "pinia";
import { Web3 } from "web3";
import addressesJson from "~/assets/contracts/addresses.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import SafeMultiSendCallOnlyJson from "~/assets/contracts/safe/SafeMultiSendCallOnly.json";
import { decodeNavUpdateEntry } from "~/composables/nav/navDecoder";
import { useFundStore } from "~/store/fund.store";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type { IContractAddresses } from "~/types/addresses";
import { PositionType, PositionTypesMap } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;
const SafeMultiSendCallOnlyAddresses: IContractAddresses = SafeMultiSendCallOnlyJson.networkAddresses as IContractAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";

// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.
const excludeTestFunds = getLocalStorageItem("excludeTestFunds", true);
const excludeNAVDetails = true;

// interface
export interface IExcludeNAVDetailsHashes {
  [chainId: string]: string[]
}

export interface IUniqueNAVMethods {
  [detailsHash: string]: boolean
}


/*
  @dev: TODO: MOVE excludeFundAddrs TO FILE
*/
const excludeFundAddrs = {
  "0x89": [
    "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E",
    "0x8fAE33f10854c20a811246849A0d4131caf72125",
    "0x6DFbEE70f1250C2dECb3E9bCb2BE3AF19b15e631",
    "0xf48E3fa13cb2390e472cf1CA64F941eB7BD27475",
    "0x82CBA6D1A6dCeb408d7F048493262b83c9744f4D",
    "0xcfD904C4C857784686029995886d627da1aeFbe4",
    "0xe93CB20Fc113355753B6D237c3949E0452981dC3",
    "0x6edC5f675C5A20e867aeF0633033a17EA256637E",
    "0x920fdA0F59bDc852eD19e3ad975a808101ea2a29",
    "0x1550D564fEBE8c398F3cc398c9ac2a9e89E89A4F",
    "0x07094Bb5f175A4E6b074e5E79F6439a8A929533B",
    "0x98F1c2035680E4215cD5726a11279da96C07835F",
    "0xdac03eD03EFDa65A1488c7f3f0302636491726B6",
    "0xBb1E02AcA8F7Cb2403c0Bf3aaA74001d38Beb488",
  ],
  "0xa4b1": [
    "0xA5138779Bb08C8DE44692e183c586817a0bcEb42",
  ],
  "0xfc": [],
  "0x1": [],
} as Record<string, string[]>;

/*
  @dev: TODO: MOVE excludeNAVDetailsHashes TO FILE

*/


const excludeNAVDetailsHashes = {
  "0x89": [
    "0xd87d9b63abe927264903466398cabf9e105ac2fae7c6dc76f822d8ef89e7012d",
    "0xe63fd752a9fdc61a6bb0ac72d9134f09f1f85778192fa6d10278bd9a09a425e9",
    "0x36e7ba53628d044345c9d4e0e9b917f5479d1d4a3e212a0e5b56493f67958020",
    "0x6798edd8ad8861e9e653967ad7938d3646b3058d1a5b6dc98352d99648f45e43",
    "0xeaf175c9485c6b69e0d2005b58a57da04d12c8b0f27bae21547abebdf527c374",
    "0x94f12e7002169840f86b41a8dd9b238449dcf449c2f9be33e3d3717c4bdb3b84",
    "0x37c0cad1bac6a4cdd3a7e5f13162b8b1c7fd8db96ce2557de5db67e1f8213ece",
    "0x003651b0da2306f94cde72d015b08ba7d647d94cddd832a0ece2814a433abf5f",
    "0xb749dd887a361f0a54620e6b951cdbe81b247fd13579b1adccbebb3f20d2fdc5",
  ],
  "0xa4b1": [],
  "0xfc": [],
  "0x1": [],
} as IExcludeNAVDetailsHashes;

interface IState {
  funds: IFund[];
  // All original NAV methods.
  allNavMethods: INAVMethod[],
  uniqueNavMethods: INAVMethod[],
  // Get the address of the original fund of all original NAV methods.
  navMethodDetailsHashToFundAddress: Record<string, string>,
}

export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    funds: [] as IFund[],
    allNavMethods: [] as INAVMethod[],
    uniqueNavMethods: [] as INAVMethod[],
    navMethodDetailsHashToFundAddress: {} as Record<string, string>,
  }),
  getters: {
    fundStore(): any {
      return useFundStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): Web3 {
      return this.web3Store.web3;
    },
    /**
     * Contracts
     */
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundFactoryContract(): Contract {
      const contractAddress = addresses[GovernableFundFactoryContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(GovernableFundFactory.abi, contractAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<...>
    rethinkReaderContract(): Contract {
      const contractAddress = addresses[RethinkReaderContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(RethinkReader.abi, contractAddress)
    },
    safeMultiSendCallOnlyToAddress(): string {
      return SafeMultiSendCallOnlyAddresses[parseInt(this.web3Store.chainId).toString()]
    },
  },
  actions: {
    callWithRetry(method: any): any {
      return this.web3Store.callWithRetry(method);
    },
    batchFetchFundSettings() {
      /** @dev: I tried many, many things to make this BatchRequest work with web3 4.x, this is the closest I came.
       * https://docs.web3js.org/guides/web3_upgrade_guide/x/#web3-batchrequest
       *       const batch = new this.web3.BatchRequest();
       *       // Define the request for getFundSettings
       *       const con = new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress);
       *       const getFundSettingsRequest: any = {
       *         jsonrpc: "2.0",
       *         id: 1,
       *         method: "eth_call",
       *         params: [{
       *           to: this.selectedFundAddress,
       *           data: con.methods.getFundSettings().encodeABI(),
       *         }, "latest"],
       *       };
       *
       *       // Add the request to the batch and capture the promise
       *       const getFundSettingsPromise = batch.add(getFundSettingsRequest);
       *
       *       // Execute the batch
       *       const rep = batch.execute();
       *       console.log("rep: ", rep);
       *
       *       // Handle the promise
       *       getFundSettingsPromise.then((response: any) => {
       *         console.log(response);
       *       }).catch((error: any) => {
       *         console.error("Error fetching getFundSettings:", error);
       *       });
       */
      console.error("not implemented");
    },
    /**
     * Fetch funds and their metadata and NAV data.
     * This will return funds with just enough data to populate the discover table.
     * More data can be fetched from fundSettings later if needed, or added to the reader contract.
     */
    async fetchFundsMetadata(fundAddresses: string[], fundsInfo: any): Promise<IFund[]> {
      const funds: IFund[] = [];

      try {
        // @dev NOTE: the second parameter to getFundNavMetaData is navEntryIndex, but it is currently
        //  not used in the contract code, so I have set it to 0. Change this part in the future
        //  if the contract changes.
        const dataNAVs: Record<string, any[]> = await this.callWithRetry(() =>
          this.rethinkReaderContract.methods.getFundNavMetaData(
            fundAddresses, 0,
          ).call(),
        );

        fundAddresses.forEach((address, index) => {
          if (
            excludeTestFunds &&
            excludeFundAddrs[this.web3Store.chainId].includes(address)) {
            return;
          }

          const fundStartTime = dataNAVs.startTime[index];
          const fund: IFund = {
            chainName: this.web3Store.chainName,
            chainShort: this.web3Store.chainShort,
            address,
            title: dataNAVs.fundName[index] || "N/A",
            description: "N/A",
            safeAddress: "",
            governorAddress: "",
            photoUrl: defaultAvatar,
            inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
            fundToken: {
              symbol: fundsInfo[address].fundSymbol,
              address,
              decimals: -1,
            } as IToken,
            fundTokenTotalSupply: BigInt("0"),
            baseToken: {
              address: "",  // Not important here.
              symbol: dataNAVs.fundBaseTokenSymbol[index],
              decimals: Number(dataNAVs.fundBaseTokenDecimals[index]),
            },
            governanceToken: {} as IToken,  // Not important here, for now.
            governanceTokenTotalSupply: BigInt("0"),
            totalNAVWei: dataNAVs.totalNav[index],
            totalDepositBalance: dataNAVs.totalDepositBal[index] || BigInt("0"),
            cumulativeReturnPercent: this.calculateCumulativeReturnPercent(dataNAVs, index),
            monthlyReturnPercent: 0,
            sharpeRatio: 0,
            positionTypeCounts: [
              {
                type: PositionTypesMap[PositionType.Liquid],
                count: Number(dataNAVs.liquidLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.Composable],
                count: Number(dataNAVs.composableLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.NFT],
                count: Number(dataNAVs.nftLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.Illiquid],
                count: Number(dataNAVs.illiquidLen[index] || 0),
              },
            ] as IPositionTypeCount[],

            // My Fund Positions
            netDeposits: "",
            // Overview fields
            isWhitelistedDeposits: true,
            allowedDepositAddresses: [],
            allowedManagerAddresses: [],
            plannedSettlementPeriod: "",
            minLiquidAssetShare: "",

            // Governance
            votingDelay: "",
            votingPeriod: "",
            proposalThreshold: "",
            quorumVotes: 0n,
            quorumVotesFormatted: "0",
            quorumNumerator: BigInt(0),
            quorumDenominator: BigInt(0),
            quorumPercentage: "N/A",
            lateQuorum: "",

            // Fees
            depositFee: "",
            depositFeeAddress: "",
            withdrawFee: "",
            withdrawFeeAddress: "",
            managementPeriod: "",
            managementFee: "",
            managementFeeAddress: "",
            performancePeriod: "",
            performanceFee: "",
            performanceFeeAddress: "",
            performaceHurdleRateBps: "",
            feeCollectors: [],
            feeBalance: BigInt(0),  // in base token
            safeContractBaseTokenBalance: BigInt(0),
            fundContractBaseTokenBalance: BigInt(0),

            // NAV Updates
            navUpdates: [] as INAVUpdate[],
          };

          const metaDataJson = dataNAVs.fundMetadata[index];
          // Process metadata if available
          if (metaDataJson) {
            const metaData = JSON.parse(metaDataJson);
            fund.description = metaData.description;
            fund.photoUrl = metaData.photoUrl || defaultAvatar;
            fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
            fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
          }
          funds.push(fund);
        })
        return funds;
      } catch (error) {
        console.error("Error calling getFundNavMetaData: ", error, " addresses: ", fundAddresses);
        return funds;
      }
    },
    calculateCumulativeReturnPercent(dataNAVs: Record<string, any>, index: number): number {
      // calculate cumulativeReturnPercent
      // totalNAV() - _totalDepositBal  / _totalDepositBal
      let cumulativeReturnPercent = 0;
      const totalDepositBal = dataNAVs.totalDepositBal[index] || BigInt("0");
      const totalNAV = dataNAVs.totalNav[index] || BigInt("0");

      if (totalNAV > BigInt(0) && totalDepositBal > BigInt(0)) {
        const baseTokenDecimals = Number(dataNAVs.fundBaseTokenDecimals[index])
        const fixedTotalNAV = FixedNumber.fromValue(totalNAV, baseTokenDecimals);
        const fixedTotalDepositBal = FixedNumber.fromValue(totalDepositBal, baseTokenDecimals);
        
        // cumulativeReturnPercent = (totalNAV - totalDepositBal) / totalDepositBal
        const cumulativeReturn = fixedTotalNAV
          .sub(fixedTotalDepositBal)
          .div(fixedTotalDepositBal);

        cumulativeReturnPercent = cumulativeReturn.toUnsafeFloat();
      }
      return cumulativeReturnPercent;
    },
    async fetchFundsInfoArrays() {
      const fundFactoryContract = this.fundFactoryContract;
      const fundsLength = await this.callWithRetry(() =>
        fundFactoryContract.methods.registeredFundsLength().call(),
      );

      return await this.callWithRetry(() =>
        fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
      );
    },
    /**
     * Fetches all funds data from the GovernableFundFactory.
     */
    async fetchFunds() {
      console.log("fetchFunds");
      // Reset funds as we will populate them with new data.
      this.funds = [];

      const fundsInfoArrays = await this.fetchFundsInfoArrays();
      const fundAddresses: string[] = fundsInfoArrays[0];
      const fundsInfo = Object.fromEntries(fundAddresses.map((address, index) => [address, fundsInfoArrays[1][index]]));

      const funds = await this.fetchFundsMetadata(fundAddresses, fundsInfo);
      console.log("All funds: ", funds);

      // Using the spread operator to append each element
      this.funds.push(...funds);

      // Fetch all possible NAV methods for all funds
      this.fetchAllNavMethods(fundsInfoArrays);
    },
    /**
     * Fetches all NAV methods
     */
    async fetchAllNavMethods(fundsInfoArrays: any[]) {
      const fundAddresses: string[] = fundsInfoArrays[0];

      const allFundsNavData = await this.callWithRetry(() =>
        this.rethinkReaderContract.methods.bulkGetNavData(fundAddresses).call(),
      );
      const allMethods: INAVMethod[] = [];
      this.navMethodDetailsHashToFundAddress = {};

      // console.log("allFundsNavData: ", allFundsNavData);
      console.log("Fetch all NAV methods");
      for (const [fundIndex, fundNavData] of allFundsNavData.entries()) {
        if (!fundNavData.encodedNavUpdate?.length) continue;

        for (const [navUpdateIndex, encodedNavUpdate] of fundNavData.encodedNavUpdate.entries()) {
          try {
            // Decode NAV update methods data.
            const navMethods: Record<string, any>[] = decodeNavUpdateEntry(encodedNavUpdate);

            for (const [navMethodIndex, navMethod] of navMethods.entries()) {
              // Ignore NAV methods that are not original NAV entries.
              if (navMethod.isPastNAVUpdate || navMethod.pastNAVUpdateIndex !== 0n) {
                // console.log("[SKIP] navMethod: ", navMethod);
                continue;
              }
              // console.log("[KEEP] navMethod: ", navMethod);
              const parsedNavMethod: INAVMethod = this.fundStore.parseNAVMethod(navMethodIndex, navMethod);

              if (
                excludeNAVDetails &&
                parsedNavMethod.detailsHash &&
                excludeNAVDetailsHashes[this.web3Store.chainId].includes(parsedNavMethod.detailsHash)) {
                continue;
              }

              // Set the past NAV update fund address to the original fund address
              // the entry was created on.
              const fundAddress = fundAddresses[fundIndex];
              parsedNavMethod.pastNAVUpdateEntryFundAddress = fundAddress;
              parsedNavMethod.pastNAVUpdateEntrySafeAddress = fundsInfoArrays[1][fundIndex].safe;
              allMethods.push(parsedNavMethod);
              if (parsedNavMethod.detailsHash) {
                this.navMethodDetailsHashToFundAddress[parsedNavMethod.detailsHash] = fundAddress;
              } else {
                console.error("Missing detailsHash for NAV method ", navUpdateIndex, navMethod);
              }
            }
          } catch (error: any) {
            console.log("error processing all NAV methods: ", error)
          }
        }
      }

      console.log("allMethods: ", allMethods)
      this.allNavMethods = allMethods;
      const seenValues = {} as IUniqueNAVMethods;
      const uniqueMethods = allMethods.filter((method: any) => {
        if (!seenValues[method.detailsHash]) {
          seenValues[method.detailsHash] = true;
          return true; // include value in the new list
        }
        return false; // exclude value from the new list
      });

      this.uniqueNavMethods = uniqueMethods;
    },
  },
});
