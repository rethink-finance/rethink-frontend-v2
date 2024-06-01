import { defineStore } from "pinia";
import { Web3 } from "web3";
import { ethers } from "ethers";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import RethinkFundGovernor from "~/assets/contracts/RethinkFundGovernor.json";
import ERC20 from "~/assets/contracts/ERC20.json";
import addressesJson from "~/assets/contracts/addresses.json";
import { useAccountStore } from "~/store/account.store";
import {
  NAVEntryTypeToPositionTypeMap,
  PositionType,
  PositionTypeKeys,
  PositionTypes,
} from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type INAVUpdate from "~/types/nav_update";
import type INAVMethod from "~/types/nav_method";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IToken from "~/types/token";
import type IPositionTypeCount from "~/types/position_type";
import defaultAvatar from "@/assets/images/default_avatar.webp";
import { formatJson, pluralizeWord } from "~/composables/utils";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";


interface IState {
  fund?: IFund;
  userBaseTokenBalance: bigint;
  userFundTokenBalance: bigint;
  userGovernanceTokenBalance: bigint;
  userFundAllowance: bigint;
  userFundDelegateAddress: string;
  userFundShareValue: bigint
  selectedFundAddress: string;
  fundManagedNAVMethods: INAVMethod[],
}


export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: undefined,
    userBaseTokenBalance: BigInt("0"),
    userFundTokenBalance: BigInt("0"),
    userGovernanceTokenBalance: BigInt("0"),
    userFundAllowance: BigInt("0"),
    userFundShareValue: BigInt("0"),
    userFundDelegateAddress: "",
    selectedFundAddress: "",
    fundManagedNAVMethods: [],
  }),
  getters: {
    accountStore(): any {
      return useAccountStore();
    },
    activeAccountAddress(): string | undefined {
      return this.accountStore.activeAccount?.address;
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): Web3 {
      return this.web3Store.web3;
    },
    baseToFundTokenExchangeRate(state: IState): number {
      if (!state.fund?.fundTokenTotalSupply) return 0;
      return Number(state.fund.totalNAVWei / state.fund.fundTokenTotalSupply);
    },
    fundToBaseTokenExchangeRate(state: IState): number {
      if (!state.fund?.totalNAVWei) return 0;
      return 1 / this.baseToFundTokenExchangeRate;
    },
    fundTotalNAVFormattedShort(state: IState): string {
      if (!state.fund?.totalNAVWei) return "N/A";
      const totalNAV = Number(formatTokenValue(state.fund.totalNAVWei, state.fund.baseToken.decimals, false));
      return formatNumberShort(totalNAV) + " " + state.fund.baseToken.symbol;
    },
    selectedFundSlug(state: IState): string {
      return (state.fund?.fundToken.symbol || "") + "-" + (state.fund?.address || "");
    },
    fundLastNAVUpdate(state: IState): INAVUpdate | undefined {
      if (!state.fund?.navUpdates.length) return undefined;
      return state.fund.navUpdates[state.fund.navUpdates.length - 1];
    },
    fundLastNAVUpdateEntries(): INAVMethod[] {
      return this.fundLastNAVUpdate?.entries || [];
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
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundContract(): Contract {
      return new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress)
    },
    // @ts-expect-error: we should extend the return type ...
    fundBaseTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund?.baseToken?.address)
    },
  },
  actions: {
    /**
     * Fetches all needed fund data..
     */
    async getFund(fundAddress: string) {
      this.selectedFundAddress = fundAddress;
      this.fund = undefined;
      this.fundManagedNAVMethods = [];

      try {
        this.fund = await this.fetchFundData() as IFund;

        // Set fund NAV methods to be edited.
        // Create a deep copy of the array to prevent changing the original by reference.
        // TODO first check if they already exist in the localStorage as draft?
        console.log("fundLastNAVUpdateEntries: ", this.fundLastNAVUpdateEntries);
        this.fundManagedNAVMethods = JSON.parse(JSON.stringify(this.fundLastNAVUpdateEntries));
        console.warn("fundManagedNAVMethods: ", this.fundManagedNAVMethods);
        console.log("fund: ", this.fund)
      } catch (e) {
        console.error(`Failed fetching fund ${fundAddress} -> `, e)
      }
      try {
        await this.fetchUserBalances();
      } catch (e) {
        console.error(`Failed fetching user fundBalances fund ${fundAddress} -> `, e)
      }
    },
    /**
     * Fetches multiple fund data:
     * - getFundSettings
     * - getFundStartTime
     * - fundMetadata
     *
     * @dev: would be better to separate fundSettings from (startTime & metadata), as sometimes we already
     *   have the fund settings from the discovery page.
     */
    async fetchFundData(): Promise<IFund> {
      // Fetch inception date
      const settingsData = await this.fundContract.methods.getFundSettings().call();
      // Process the fund settings with a method assumed to be available in the current scope
      const fundSettings: IFundSettings = this.parseFundSettings(settingsData);

      const fund = await this.fetchFundMetadata(fundSettings);

      try {
        const dataNAV = await this.rethinkReaderContract.methods.getNAVDataForFund(fundSettings.fundAddress).call();
        console.log("fund NAV: ", dataNAV)
        fund.positionTypeCounts = this.parseFundPositionTypeCounts(dataNAV);
        fund.navUpdates = await this.parseFundNAVUpdates(dataNAV);
      } catch (error) {
        console.error("Error calling getNAVDataForFund: ", error, "fund: ", fundSettings.fundAddress);
      }
      return fund;
    },
    parseFundSettings(fundData: any) {
      const fundSettings: Partial<IFundSettings> = {};

      // Directly iterate over the fund details object's entries.
      Object.entries(fundData).forEach(([key, value]) => {
        // Assume that every key in quantity corresponds to a valid key in IFundSettings.
        const detailKey = key as keyof IFundSettings;

        // Convert bigint values to strings, otherwise assign the value directly.
        // This approach skips checking if detailKey is explicitly part of fundSettings
        // since fundSettings is typed as Partial<IFundSettings> and initialized accordingly.
        fundSettings[detailKey] = typeof value === "bigint" ? value.toString() : value;
      });

      return fundSettings as IFundSettings;
    },
    fetchUserBalances() {
      if (!this.accountStore.activeAccount?.address) return;

      return Promise.all([
        this.fetchUserBaseTokenBalance(),
        this.fetchUserFundTokenBalance(),
        this.fetchUserFundDelegateAddress(),
        this.fetchUserFundShareValue(),
        this.fetchUserFundAllowance(),
      ]);
    },
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    async fetchFundMetadata(fundSettings: IFundSettings): Promise<IFund> {
      // @dev: would be better to just have this available in the FundSettings data.
      // Fetch base, fund and governance ERC20 token symbol and decimals.
      const fundBaseTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.baseToken);
      const fundTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.fundAddress);
      const governanceTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.governanceToken);
      const rethinkFundGovernorContract = new this.web3.eth.Contract(
        RethinkFundGovernor.abi,
        fundSettings.governor,
      );

      // GovernableFund contract to get totalNAV.
      const fundContract = new this.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);
      const latestBlock = await this.web3.eth.getBlockNumber();

      try {
        // Fetch all token symbols, decimals and values.
        const results = await Promise.allSettled([
          fundContract.methods.getFundStartTime().call(),
          fundContract.methods.fundMetadata().call() as Promise<string>,
          this.web3Store.getTokenInfo(fundBaseTokenContract, "symbol", fundSettings.baseToken) as Promise<string>,
          this.web3Store.getTokenInfo(fundBaseTokenContract, "decimals", fundSettings.baseToken) as Promise<number>,
          this.web3Store.getTokenInfo(governanceTokenContract, "symbol", fundSettings.governanceToken) as Promise<string>,
          this.web3Store.getTokenInfo(governanceTokenContract, "decimals", fundSettings.governanceToken) as Promise<number>,
          this.web3Store.getTokenInfo(fundTokenContract, "decimals", fundSettings.governanceToken) as Promise<number>,
          fundTokenContract.methods.totalSupply().call() as Promise<bigint>,  // Get un-cached total supply.
          fundContract.methods.totalNAV().call() as Promise<bigint>,
          rethinkFundGovernorContract.methods.votingDelay().call() as Promise<number>,
          rethinkFundGovernorContract.methods.votingPeriod().call() as Promise<number>,
          rethinkFundGovernorContract.methods.proposalThreshold().call() as Promise<number>,
          rethinkFundGovernorContract.methods.lateQuorumVoteExtension().call() as Promise<number>,
          rethinkFundGovernorContract.methods.quorum(latestBlock).call() as Promise<bigint>,
        ]);

        const [
          fundStartTime,
          metaDataJson,
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          fundTokenDecimals,
          fundTokenTotalSupply,
          fundTotalNAV,
          fundVotingDelay,
          fundVotingPeriod,
          fundProposalThreshold,
          fundLateQuorum,
          quorum,
        ]: any[] = results.map(result => {
          if (result.status === "fulfilled") {
            return result.value
          }
          console.error("Failed fetching fund data value for: ", result)
          return undefined
        });

        // console.log("fundTokenTotalSupply: ", fundTokenTotalSupply)
        console.log("fundSettings: ", fundSettings)

        const fund: IFund = {
          chainName: this.web3Store.chainName,
          chainShort: this.web3Store.chainShort,
          address: fundSettings.fundAddress || "",
          title: fundSettings.fundName || "N/A",
          description: "N/A",
          safeAddress: fundSettings.safe || "",
          governorAddress: fundSettings.governor || "",
          photoUrl: defaultAvatar,
          inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
          fundToken: {
            symbol: fundSettings.fundSymbol,
            address: fundSettings.fundAddress,
            decimals: fundTokenDecimals ?? 18,
          } as IToken,
          baseToken: {
            symbol: baseTokenSymbol ?? "",
            address: fundSettings.baseToken,
            decimals: baseTokenDecimals ?? 18,
          } as IToken,
          governanceToken: {
            symbol: governanceTokenSymbol ?? "",
            address: fundSettings.governanceToken,
            decimals: governanceTokenDecimals ?? 18,
          } as IToken,
          totalNAVWei: fundTotalNAV || BigInt("0"),
          fundTokenTotalSupply,
          cumulativeReturnPercent: 0,
          monthlyReturnPercent: 0,
          sharpeRatio: 0,
          positionTypeCounts: [] as IPositionTypeCount[],
          cyclePendingRequests: [] as ICyclePendingRequest[],

          // My Fund Positions
          netDeposits: "",

          // Overview fields
          depositAddresses: fundSettings.allowedDepositAddrs,
          managementAddresses: fundSettings.allowedManagers,
          plannedSettlementPeriod: "",
          minLiquidAssetShare: "",

          // Governance
          // TODO need to fetch the CLOCK_MODE to know if it is in seconds or blocks
          //  The unit this duration is expressed in depends on the clock (see EIP-6372) this contract uses.
          //  Machine-readable description of the clock as specified in EIP-6372.
          votingDelay: pluralizeWord("second", fundVotingDelay),
          votingPeriod: pluralizeWord("second", fundVotingPeriod),
          proposalThreshold: (!fundProposalThreshold && fundProposalThreshold !== 0n) ? "N/A" : `${commify(fundProposalThreshold)} ${governanceTokenSymbol || "votes"}`,
          quorum: formatPercent(quorum, false, "N/A"),
          lateQuorum: pluralizeWord("second", fundLateQuorum),

          // Fees
          depositFee: fundSettings.depositFee.toString(),
          depositFeeAddress: fundSettings.feeCollectors[0],
          withdrawFee: fundSettings.withdrawFee.toString(),
          withdrawFeeAddress: fundSettings.feeCollectors[1],
          managementFee: fundSettings.managementFee.toString(),
          managementFeeAddress: fundSettings.feeCollectors[2],
          performanceFee: fundSettings.performanceFee.toString(),
          performanceFeeAddress: fundSettings.feeCollectors[3],
          performaceHurdleRateBps: fundSettings.performaceHurdleRateBps,
          feeCollectors: fundSettings.feeCollectors,

          // NAV Updates
          navUpdates: [] as INAVUpdate[],
        } as IFund;

        // Process metadata if available
        if (metaDataJson) {
          const metaData = JSON.parse(metaDataJson);
          fund.description = metaData.description;
          fund.photoUrl = metaData.photoUrl || defaultAvatar;
          fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
          fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
        }

        return fund;
      } catch (error) {
        console.error("Error in promises: ", error, "fund: ", fundSettings);
        return {} as IFund; // Return an empty or default object in case of error
      }
    },
    parseFundPositionTypeCounts(dataNAV: any): IPositionTypeCount[] {
      const positionTypeCounts = [];

      for (const positionType of PositionTypes) {
        const positionTypeData = dataNAV[positionType.key];
        // Get the last array for each NAV position type. The last array represents
        // the latest NAV update for each position type (liquid, nft, composable, illiquid).
        const lastIndex = positionTypeData?.length || 0;
        const lastNAVUpdate = positionTypeData[lastIndex - 1];
        positionTypeCounts.push({
          type: positionType,
          count: lastNAVUpdate?.length || 0,
        })
      }

      return positionTypeCounts;
    },
    parseNAVEntry(navEntryData: Record<string, any>): INAVMethod {
      let description;
      const positionType = NAVEntryTypeToPositionTypeMap[navEntryData.entryType];

      try {
        if (navEntryData.description === "") {
          description = {};
        } else {
          description = JSON.parse(navEntryData.description ?? "{}");
        }
      } catch (error) {
        // Handle the error or rethrow it
        console.warn("Failed to parse NAV entry JSON description string: ", error);
      }

      const details = cleanComplexWeb3Data(navEntryData);
      const detailsJson = formatJson(details);

      return {
        positionType,
        positionName: description?.positionName,
        valuationSource: description?.valuationSource,
        details,
        detailsJson,
        detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
      } as INAVMethod
    },
    async parseFundNAVUpdates(dataNAV: any): Promise<INAVUpdate[]> {
      const navUpdates = [] as INAVUpdate[];
      // Get number of NAV updates for each NAV type (liquid, illiquid, nft, composable).
      const navUpdatesLen = dataNAV[PositionType.Liquid].length;
      const fundNavUpdateTimes = await this.fundContract.methods.getNavUpdateTime(0, navUpdatesLen).call();

      for (let i= 0; i < navUpdatesLen; i++) {
        let totalNAV = BigInt("0");
        const quantity = {
          [PositionType.Liquid]: BigInt("0"),
          [PositionType.Illiquid]: BigInt("0"),
          [PositionType.Composable]: BigInt("0"),
          [PositionType.NFT]: BigInt("0"),
        } as Record<PositionType, bigint>;

        PositionTypeKeys.forEach((positionType: PositionType) => {
          // Check if the key exists in the object to avoid errors
          if (dataNAV[positionType][i]) {
            quantity[positionType] = dataNAV[positionType][i].reduce((sum: bigint, value: bigint) => sum + value, BigInt("0"));
            // Sum the array values and add to total
            totalNAV += quantity[positionType];
          }
          return totalNAV;
        });

        navUpdates.push(
          {
            // If the datetime of the NAV update is available format it, otherwise just use the index (e.g. #2).
            date: fundNavUpdateTimes[i] ? formatDate(new Date(Number(fundNavUpdateTimes[i]) * 1000)) : `#${(i+1).toString()}}`,
            totalNAV,
            quantity,
            entries: [],
          },
        )
      }

      // Fetch NAV JSON entries for each NAV update.
      const promises: Promise<any>[] = Array.from(
        { length: navUpdatesLen },
        (_, index) => this.fundContract.methods.getNavEntry(index).call(),
      );

      // Each NAV update has more entries.
      // Parse and store them to the NAV update entries.
      const navUpdatePromises = await Promise.allSettled(promises);
      // console.log("navUpdatePromises: ", navUpdatePromises);

      // Process results
      navUpdatePromises.forEach((navUpdateResult, index) => {
        if (navUpdateResult.status === "fulfilled") {
          const navEntries: Record<string, any>[] = navUpdateResult.value;

          for (const navEntry of navEntries) {
            navUpdates[index].entries.push(this.parseNAVEntry(navEntry))
          }
        } else {
          console.error(`Failed to fetch NAV entry ${index}:`, navUpdateResult.reason);
        }
      });

      return navUpdates;
    },
    /**
     * Fetches connected user's wallet balance of the base/denomination token.
     */
    async fetchUserBaseTokenBalance() {
      this.userBaseTokenBalance = BigInt("0");

      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token address is not available.")
      }
      if (!this.activeAccountAddress) throw new Error("Active account not found");

      this.userBaseTokenBalance = await this.fundBaseTokenContract.methods.balanceOf(this.activeAccountAddress).call();

      console.log(`user base token balance of ${this.fund?.baseToken?.symbol} is ${this.userBaseTokenBalance}`);
      return this.userBaseTokenBalance;
    },
    /**
     * Fetch connected user's wallet balance of the fund token.
     */
    async fetchUserFundTokenBalance() {
      this.userFundTokenBalance = BigInt("0");

      if (!this.fund?.fundToken?.address) {
        throw new Error("Fund token address is not available.")
      }
      if (!this.activeAccountAddress) throw new Error("Active account not found");

      this.userFundTokenBalance = await this.fundContract.methods.balanceOf(this.activeAccountAddress).call();

      console.log(`user fund token balance of ${this.fund?.fundToken?.symbol} is ${this.userFundTokenBalance}`);
      return this.userFundTokenBalance;
    },
    /**
     * Fetch connected user's wallet fund delegate address.
     */
    async fetchUserFundDelegateAddress() {
      this.userFundDelegateAddress = "";
      if (!this.fund?.fundToken?.address) {
        throw new Error("Fund token address is not available.")
      }
      if (!this.activeAccountAddress) throw new Error("Active account not found");

      this.userFundDelegateAddress = await this.fundContract.methods.delegates(this.activeAccountAddress).call();

      console.log("user fund delegates: ", this.userFundDelegateAddress);
      return this.userFundDelegateAddress;
    },
    /**
     * Fetch connected user's fund allowance.
     * Amount of tokens the fund is allowed to act with (transfer/deposit/withdraw...).
     */
    async fetchUserFundAllowance() {
      this.userFundAllowance = BigInt("0");

      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token is not available.")
      }
      if (!this.activeAccountAddress) return console.error("Active account not found");

      this.userFundAllowance = await this.fundBaseTokenContract.methods.allowance(
        this.activeAccountAddress, this.selectedFundAddress,
      ).call();

      console.log(`user fund allowance of ${this.fund?.baseToken?.symbol} is ${this.userFundAllowance}`);
      return this.userFundAllowance;
    },
    /**
     * Fetch user's fund share value (denominated in base token).
     */
    async fetchUserFundShareValue() {
      this.userFundShareValue = BigInt("0");

      if (!this.activeAccountAddress) return console.error("Active account not found");

      let balanceWei = BigInt("0");
      try {
        balanceWei = await this.fundContract.methods.valueOf(this.activeAccountAddress).call();
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ", e,
        );
      }
      console.log("balanceWei user fund share value:", balanceWei);

      this.userFundShareValue = balanceWei;
      return this.userFundShareValue;
    },
  },
});
