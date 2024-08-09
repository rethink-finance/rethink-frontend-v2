import defaultAvatar from "@/assets/images/default_avatar.webp";
import { ethers, FixedNumber } from "ethers";
import { defineStore } from "pinia";
import { Web3 } from "web3";
import ERC20 from "~/assets/contracts/ERC20.json";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkFundGovernor from "~/assets/contracts/RethinkFundGovernor.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import addressesJson from "~/assets/contracts/addresses.json";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import { formatJson, pluralizeWord } from "~/composables/utils";
import { useAccountStore } from "~/store/account.store";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type IClockMode from "~/types/clock_mode";
import { ClockMode, ClockModeMap } from "~/types/enums/clock_mode";
import {
  FundTransactionType,
  FundTransactionTypeStorageSlotIdxMap,
} from "~/types/enums/fund_transaction_type";
import {
  NAVEntryTypeToPositionTypeMap,
  PositionType,
  PositionTypeKeys,
  PositionTypes
} from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

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
  userDepositRequest?: IFundTransactionRequest;
  userRedemptionRequest?: IFundTransactionRequest;
  selectedFundAddress: string;
  // Fund NAV methods that user can manage and change, delete, add...
  fundManagedNAVMethods: INAVMethod[],
  // Cached roleMod addresses for each fund.
  fundRoleModAddress: Record<string, string>,
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
    userDepositRequest: undefined,
    userRedemptionRequest: undefined,
    selectedFundAddress: "",
    fundManagedNAVMethods: [],
    fundRoleModAddress: {},
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
    baseToFundTokenExchangeRate(): number {
      // If there was no NAV update yet, the exchange rate is 1:1
      if (!this.fundLastNAVUpdate) return 1
      if (!this.fund?.fundTokenTotalSupply) return 0;

      // Create FixedNumber instances
      const totalNAV = FixedNumber.fromString(
        ethers.formatUnits(this.fund.totalNAVWei, this.fund.baseToken.decimals),
      );
      const fundTokenTotalSupply = FixedNumber.fromString(
        ethers.formatUnits(this.fund.fundTokenTotalSupply, this.fund.fundToken.decimals),
      );

      // Perform the division
      return Number(totalNAV.div(fundTokenTotalSupply));
    },
    fundToBaseTokenExchangeRate(): number {
      // If there was no NAV update yet, the exchange rate is 1:1
      if (!this.fundLastNAVUpdate) return 1
      if (!this.fund?.totalNAVWei || !this.baseToFundTokenExchangeRate) return 0;

      const totalNAV = FixedNumber.fromString(
        ethers.formatUnits(this.fund.totalNAVWei, this.fund.baseToken.decimals),
      );
      const fundTokenTotalSupply = FixedNumber.fromString(
        ethers.formatUnits(this.fund.fundTokenTotalSupply, this.fund.fundToken.decimals),
      );
      return Number(fundTokenTotalSupply.div(totalNAV));
    },
    fundTotalNAVFormattedShort(state: IState): string {
      if (!state.fund?.totalNAVWei) return "N/A";
      const totalNAV = Number(formatTokenValue(state.fund.totalNAVWei, state.fund.baseToken.decimals, false));
      return formatNumberShort(totalNAV) + " " + state.fund.baseToken.symbol;
    },
    selectedFundSlug(state: IState): string {
      const chainId = this.web3Store?.chainId || "";
      return (chainId) + "-" + (state.fund?.fundToken.symbol || "") + "-" + (state.fund?.address || "");
    },
    fundLastNAVUpdate(state: IState): INAVUpdate | undefined {
      if (!state.fund?.navUpdates.length) return undefined;
      return state.fund.navUpdates[state.fund.navUpdates.length - 1];
    },
    fundLastNAVUpdateMethods(): INAVMethod[] {
      return this.fundLastNAVUpdate?.entries || [];
    },
    userDepositRequestExists(): boolean {
      return (this.userDepositRequest?.amount || 0) > 0
    },
    userRedemptionRequestExists(): boolean {
      return (this.userRedemptionRequest?.amount || 0) > 0
    },
    userFundSuggestedAllowance(): bigint {
      const userBaseTokenBalance = this.userBaseTokenBalance || 0n;
      const userDepositRequestAmount = this.userDepositRequest?.amount || 0n;
      return userBaseTokenBalance + userDepositRequestAmount;
    },
    userFundSuggestedAllowanceFormatted(): string {
      return ethers.formatUnits(this.userFundSuggestedAllowance, this.fund?.baseToken.decimals);
    },
    shouldUserRequestDeposit(): boolean {
      // User deposit request does not exist yet, he should request deposit.
      return !this.userDepositRequestExists
    },
    shouldUserApproveAllowance(): boolean {
      // User deposit request exists and allowance is bigger.
      return this.userDepositRequestExists && this.userFundAllowance < (this.userDepositRequest?.amount || 0n)
    },
    canUserProcessDeposit(): boolean {
      // User deposit request exists and allowance is bigger.
      return !this.shouldUserRequestDeposit && !this.shouldUserApproveAllowance;
    },
    shouldUserWaitSettlementOrCancelDeposit(): boolean {
      // If there was no NAV update yet, the user can process deposit request.
      // There is no need to wait until the next settlement.
      if (
        !this.canUserProcessDeposit ||
        !this.fundLastNAVUpdate?.timestamp ||
        !this.userDepositRequest?.timestamp
      ) return false;
      // User deposit request exists and is valid, but there has to be at least 1 NAV update
      // made after the deposit was requested.
      return this.userDepositRequest.timestamp < this.fundLastNAVUpdate?.timestamp;
    },
    shouldUserWaitSettlementOrCancelRedemption(): boolean {
      // If there was no NAV update yet, the user can process deposit request.
      // There is no need to wait until the next settlement.
      if (
        !this.fundLastNAVUpdate?.timestamp ||
        !this.userRedemptionRequest?.timestamp
      ) return false;
      // User redemption request exists and is valid, but there has to be at least 1 NAV update
      // made after the redemption was requested.
      return this.userRedemptionRequest.timestamp < this.fundLastNAVUpdate?.timestamp;
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
    /**
     * Returns a block number of the transaction that created the safe contract.
     */
    safeContractCreationBlock(): bigint {
      return this.web3Store.getContractCreationBlock(this.fund?.safeAddress);
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundContract(): Contract {
      return new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundSafeContract(): Contract {
      return new this.web3.eth.Contract(GnosisSafeL2JSON.abi, this.fund?.safeAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundGovernorContract(): Contract {
      return new this.web3.eth.Contract(RethinkFundGovernor.abi, this.fund?.governorAddress)
    },
    // @ts-expect-error: we should extend the return type ...
    fundBaseTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund?.baseToken?.address)
    },
    // @ts-expect-error: we should extend the return type as Contract<...>...
    fundGovernanceTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund?.governanceToken.address);
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
        this.fundManagedNAVMethods = JSON.parse(
          JSON.stringify(this.fundLastNAVUpdateMethods),
        );
        console.log("fundManagedNAVMethods: ", this.fundManagedNAVMethods);
        console.log("fund: ", toRaw(this.fund))
      } catch (e) {
        console.error(`Failed fetching fund ${fundAddress} -> `, e)
      }
      try {
        await this.fetchUserBalances();
      } catch (e) {
        console.error(`Failed fetching user fundBalances fund ${fundAddress} -> `, e)
      }

      this.mergeNAVMethodsFromLocalStorage();
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
      const performancePeriod = await this.fundContract.methods.feePerformancePeriod().call();
      const managementPeriod = await this.fundContract.methods.feeManagePeriod().call();

      // Adding properties to the existing settingsData object
      settingsData.performancePeriod = performancePeriod;
      settingsData.managementPeriod = managementPeriod;

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
    parseClockMode(clockModeString: string): IClockMode {
      // Example clockModeString:
      //   - "mode=blocknumber&from=default"
      //   - "mode=timestamp"
      const params = new URLSearchParams(clockModeString);
      const mode = params.get("mode") as ClockMode || "";
      const from = params.get("from");

      if (!(mode in ClockModeMap)) {
        console.error("Fund clock mode is not in valid options: ", mode, clockModeString)
      }

      return {
        mode: ClockModeMap[mode],
        ...(from ? { from } : {}),
      } as IClockMode;
    },
    fetchUserBalances() {
      if (!this.accountStore.activeAccount?.address) return;

      return Promise.allSettled([
        this.fetchUserBaseTokenBalance(),
        this.fetchUserFundTokenBalance(),
        this.fetchUserGovernanceTokenBalance(),
        this.fetchUserFundDelegateAddress(),
        this.fetchUserFundShareValue(),
        this.fetchUserFundAllowance(),
        this.fetchUserFundDepositRedemptionRequests(),
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

      try {
        // Fetch all token symbols, decimals and values.
        const results = await Promise.allSettled([
          fundContract.methods.getFundStartTime().call(),
          fundContract.methods.fundMetadata().call() as Promise<string>,
          fundContract.methods._feeBal().call() as Promise<string>,
          fundBaseTokenContract.methods.balanceOf(fundSettings.safe).call() as Promise<string>,
          fundBaseTokenContract.methods.balanceOf(fundSettings.fundAddress).call() as Promise<string>,
          this.web3Store.getTokenInfo(fundBaseTokenContract, "symbol", fundSettings.baseToken) as Promise<string>,
          this.web3Store.getTokenInfo(fundBaseTokenContract, "decimals", fundSettings.baseToken) as Promise<number>,
          this.web3Store.getTokenInfo(governanceTokenContract, "symbol", fundSettings.governanceToken) as Promise<string>,
          this.web3Store.getTokenInfo(governanceTokenContract, "decimals", fundSettings.governanceToken) as Promise<number>,
          governanceTokenContract.methods.totalSupply().call() as Promise<bigint>,  // Get un-cached total supply.
          this.web3Store.getTokenInfo(fundTokenContract, "decimals", fundSettings.governanceToken) as Promise<number>,
          fundTokenContract.methods.totalSupply().call() as Promise<bigint>,  // Get un-cached total supply.
          fundContract.methods.totalNAV().call() as Promise<bigint>,
          rethinkFundGovernorContract.methods.votingDelay().call() as Promise<number>,
          rethinkFundGovernorContract.methods.votingPeriod().call() as Promise<number>,
          rethinkFundGovernorContract.methods.proposalThreshold().call() as Promise<number>,
          rethinkFundGovernorContract.methods.lateQuorumVoteExtension().call() as Promise<number>,
          rethinkFundGovernorContract.methods.quorumNumerator().call() as Promise<bigint>,
          rethinkFundGovernorContract.methods.quorumDenominator().call() as Promise<bigint>,
          rethinkFundGovernorContract.methods.CLOCK_MODE().call() as Promise<string>,
        ]);

        const [
          fundStartTime,
          metaDataJson,
          feeBalance,
          safeContractBaseTokenBalance,
          fundContractBaseTokenBalance,
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          governanceTokenTotalSupply,
          fundTokenDecimals,
          fundTokenTotalSupply,
          fundTotalNAV,
          fundVotingDelay,
          fundVotingPeriod,
          fundProposalThreshold,
          fundLateQuorum,
          quorumNumerator,
          quorumDenominator,
          clockModeString,
        ]: any[] = results.map(result => {
          if (result.status === "fulfilled") {
            return result.value
          }
          console.error("Failed fetching fund data value for: ", result)
          return undefined
        });

        const clockMode = this.parseClockMode(clockModeString);
        console.log("clockMode: ", clockMode);
        console.log("fundSettings: ", fundSettings)
        const quorumVotes: bigint = governanceTokenTotalSupply as bigint * quorumNumerator as bigint / quorumDenominator as bigint;

        const fund: IFund = {
          chainName: this.web3Store.chainName,
          chainShort: this.web3Store.chainShort,
          address: fundSettings.fundAddress || "",
          title: fundSettings.fundName || "N/A",
          clockMode,
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
          governanceTokenTotalSupply,
          fundTokenTotalSupply,
          cumulativeReturnPercent: 0,
          monthlyReturnPercent: 0,
          sharpeRatio: 0,
          positionTypeCounts: [] as IPositionTypeCount[],

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
          quorumVotes,
          quorumVotesFormatted: formatTokenValue(quorumVotes, governanceTokenDecimals),
          quorumNumerator,
          quorumDenominator,
          quorumPercentage: formatPercent(
            quorumDenominator ? Number(quorumNumerator) / Number(quorumDenominator) : 0,
            false,
            "N/A",
          ),
          lateQuorum: pluralizeWord("second", fundLateQuorum),

          // Fees
          depositFee: fundSettings.depositFee.toString(),
          depositFeeAddress: fundSettings.feeCollectors[0],
          withdrawFee: fundSettings.withdrawFee.toString(),
          withdrawFeeAddress: fundSettings.feeCollectors[1],
          managementPeriod: fundSettings.managementPeriod.toString(),
          managementFee: fundSettings.managementFee.toString(),
          managementFeeAddress: fundSettings.feeCollectors[2],
          performancePeriod: fundSettings.performancePeriod.toString(),
          performanceFee: fundSettings.performanceFee.toString(),
          performanceFeeAddress: fundSettings.feeCollectors[3],
          performaceHurdleRateBps: fundSettings.performaceHurdleRateBps,
          feeCollectors: fundSettings.feeCollectors,
          feeBalance: feeBalance * -1n, // Fees should be negative
          safeContractBaseTokenBalance,
          fundContractBaseTokenBalance,

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
      const fundNavUpdateTimes = await this.fundContract.methods.getNavUpdateTime(1, navUpdatesLen + 1).call();

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

        const navTimestamp = Number(fundNavUpdateTimes[i] * 1000n);
        navUpdates.push(
          {
            // If the datetime of the NAV update is available format it, otherwise just use the index (e.g. #2).
            date: fundNavUpdateTimes[i] ? formatDate(new Date(navTimestamp)) : `#${(i+1).toString()}}`,
            timestamp: navTimestamp,
            totalNAV,
            quantity,
            entries: [],
          },
        )
      }
      console.log("fundNavUpdateTimes ", fundNavUpdateTimes);
      // Fetch NAV JSON entries for each NAV update.
      const promises: Promise<any>[] = Array.from(
        { length: navUpdatesLen },
        (_, index) => this.fundContract.methods.getNavEntry(index + 1).call(),
      );

      // Each NAV update has more entries.
      // Parse and store them to the NAV update entries.
      const navUpdatePromises = await Promise.allSettled(promises);

      // Process results
      navUpdatePromises.forEach((navUpdateResult, index) => {
        if (navUpdateResult.status === "fulfilled") {
          const navEntries: Record<string, any>[] = navUpdateResult.value;
          console.log("navEntries: ", navEntries);

          for (const navEntry of navEntries) {
            navUpdates[index].entries.push(this.parseNAVEntry(navEntry))
          }
        } else {
          console.error(`Failed to fetch NAV entry ${index + 1}:`, navUpdateResult.reason);
        }
      });

      return navUpdates;
    },
    /**
     * Fetches connected user's wallet balance of the fund base/denomination token.
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
     * Fetch connected user's wallet balance of the fund governance token.
     */
    async fetchUserGovernanceTokenBalance() {
      this.userGovernanceTokenBalance = BigInt("0");

      if (!this.fund?.governanceToken?.address) {
        throw new Error("Governance token address is not available.")
      }
      if (!this.activeAccountAddress) throw new Error("Active account not found");

      this.userGovernanceTokenBalance = await this.fundGovernanceTokenContract.methods.balanceOf(
        this.activeAccountAddress,
      ).call();

      console.log(`user governance token balance is ${this.userGovernanceTokenBalance} ${this.fund?.fundToken?.symbol}`);
      return this.userGovernanceTokenBalance;
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
        console.error(          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ", e,
        );
      }
      console.log("balanceWei user fund share value:", balanceWei);

      this.userFundShareValue = balanceWei;
      return this.userFundShareValue;
    },
    /**
     * Fetch user's fund share value (denominated in base token).
     */
    async fetchUserFundDepositRedemptionRequests() {
      // this.userFundShareValue = BigInt("0");
      if (!this.activeAccountAddress) return console.error("Active account not found");
      if (!this.fund?.address) return "";

      try {
        this.userDepositRequest = await this.fetchUserFundTransactionRequest(FundTransactionType.Deposit)
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ", e,
        );
      }
      try {
        this.userRedemptionRequest = await this.fetchUserFundTransactionRequest(FundTransactionType.Redemption)
        console.log("redemption", this.userRedemptionRequest);
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ", e,
        );
      }
    },
    async fetchUserFundTransactionRequest(fundTransactionType: FundTransactionType) {
      if (!this.activeAccountAddress) return undefined;
      if (!this.fund?.address) return undefined;
      const slotId = FundTransactionTypeStorageSlotIdxMap[fundTransactionType];

      // GovernableFundStorage.sol
      const userRequestAddress = getAddressMappingStorageKeyAtIndex(this.activeAccountAddress, slotId)
      const userRequestTimestampAddress = incrementStorageKey(userRequestAddress)

      try {
        const amount = await this.web3Store.web3.eth.getStorageAt(this.fund?.address, userRequestAddress);
        let amountWei: string | bigint = ethers.stripZerosLeft(amount);
        amountWei = amountWei === "0x" ? 0n : BigInt(amountWei);

        const ts = await this.web3Store.web3.eth.getStorageAt(this.fund?.address, userRequestTimestampAddress);
        let timestamp: string | number = ethers.stripZerosLeft(ts);
        timestamp = timestamp === "0x" ? 0 : Number(timestamp);

        return {
          amount: amountWei,
          timestamp,
          type: fundTransactionType,
        } as IFundTransactionRequest;
      } catch (e) {
        console.error(
          `Failed fetching deposit/withdrawal request ${this.fund?.address} slot: ${slotId}. -> `, e,
        );
      }

      return undefined
    },
    async getRoleModAddress(): Promise<string> {
      if (!this.fund?.address) return "";

      // If we have already fetched the role mod address for the current fund, just return it.
      let roleModAddress = this.fundRoleModAddress[this.fund.address ?? ""];
      if (roleModAddress) {
        return roleModAddress;
      }

      // If role mod address was not fetched yet, fetch it now.
      const startAddress = "0x0000000000000000000000000000000000000001";
      /*
      function getModulesPaginated(
        address start,
        uint256 pageSize
      )
       */
      const safeModules = await this.fundSafeContract.methods.getModulesPaginated(startAddress, 10).call();
      roleModAddress = safeModules[0][1];
      this.fundRoleModAddress[this.fund?.address ?? ""] = roleModAddress;
      return roleModAddress;
    },
    mergeNAVMethodsFromLocalStorage() {
      let navUpdateEntries = getLocalStorageItem("navUpdateEntries");
      // if there are no NAV methods in local storage, save them
      if (!navUpdateEntries || !this.selectedFundAddress || !navUpdateEntries[this.selectedFundAddress]) {
        navUpdateEntries = {
          ...navUpdateEntries,
          [this.selectedFundAddress]: this.fundManagedNAVMethods,
        };
        setLocalStorageItem("navUpdateEntries", navUpdateEntries);
      }
      
      // if there are NAV methods in local storage, assign them to the fundManagedNAVMethods.
      this.fundManagedNAVMethods = navUpdateEntries[this.selectedFundAddress] || [];
    },
    async estimateGasFundFlowsCall(encodedFunctionCall: any) {
      try {
        const transactionObject = {
          from: this.activeAccountAddress,
          to: this.fundContract.options.address,
          data: this.fundContract.methods.fundFlowsCall(encodedFunctionCall).encodeABI(),
        };

        // Use Promise.allSettled to handle both promises
        const [gasPriceResult, gasEstimateResult] = await Promise.allSettled([
          this.web3.eth.getGasPrice(),
          this.web3.eth.estimateGas(transactionObject),
        ]);

        // Extract the results or handle errors
        const gasPrice = gasPriceResult.status === "fulfilled" ? gasPriceResult.value : undefined;
        const gasEstimate = gasEstimateResult.status === "fulfilled" ? gasEstimateResult.value : undefined;
        console.log("Estimated Gas:", gasEstimate);
        console.log("Estimated Gas Price:", gasPrice);

        return [gasPrice, gasEstimate];
      } catch (error) {
        console.error("Error estimating gas:", error);
      }
      return [undefined, undefined];
    },
  },
});
