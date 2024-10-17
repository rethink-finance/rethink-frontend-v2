import { ethers, FixedNumber } from "ethers";
import { defineStore } from "pinia";
import { Web3 } from "web3";

import { useActionState } from "../actionState.store";
import { useToastStore } from "../toasts/toast.store";
import { fetchFundMetadataAction } from "./actions/fetchFundMetadata.action";
import { fetchFundNAVUpdatesAction } from "./actions/fetchFundNAVUpdates.action";
import { fetchSimulatedNAVMethodValueAction } from "./actions/fetchSimulatedNAVMethodValue.action";
import { fetchUserBalancesAction } from "./actions/fetchUserBalances.action";
import { postUpdateNAVAction } from "./actions/postUpdateNav.action";

import addressesJson from "~/assets/contracts/addresses.json";
import { ERC20 } from "~/assets/contracts/ERC20";
import { ERC20Votes } from "~/assets/contracts/ERC20Votes";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { GovernableFundFactory } from "~/assets/contracts/GovernableFundFactory";
import { NAVCalculator } from "~/assets/contracts/NAVCalculator";
import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import { RethinkReader } from "~/assets/contracts/RethinkReader";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import { cleanComplexWeb3Data, formatJson } from "~/composables/utils";
import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
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
  PositionTypes,
  PositionTypeToNAVCacheMethod,
} from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type { INAVParts } from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";

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
  userFundShareValue: bigint;
  userDepositRequest?: IFundTransactionRequest;
  userRedemptionRequest?: IFundTransactionRequest;
  selectedFundAddress: string;
  // Fund NAV methods that user can manage and change, delete, add...
  fundManagedNAVMethods: INAVMethod[];
  // Cached roleMod addresses for each fund.
  fundRoleModAddress: Record<string, string>;
  refreshSimulateNAVCounter: number;
  // Loading flags
  isNavSimulationLoading: boolean;
  loadingUserFundDepositRedemptionRequests: boolean
}

// combine funds and fund store and map address => fund state; why only store one fund details at a time
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
    refreshSimulateNAVCounter: 0,
    // Loading flags
    isNavSimulationLoading: false,
    loadingUserFundDepositRedemptionRequests: false,
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
    fundsStore(): any {
      return useFundsStore();
    },
    toastStore(): any {
      return useToastStore();
    },
    web3(): Web3 {
      console.warn("fundStore.web3 changed", this.web3Store.web3);
      return this.web3Store.web3;
    },
    isUsingZodiacPilotExtension(): boolean {
      // Check if user is using Zodiac Pilot extension.
      // The connected wallet address is the same as custody (safe address).
      return this.activeAccountAddress === this.fund?.safeAddress;
    },
    baseToFundTokenExchangeRate(): number {
      if (!this.fund?.baseToken?.decimals || !this.fund?.fundToken?.decimals)
        return 0;

      // If there was no NAV update yet, the exchange rate is 1:1
      if (!this.fundLastNAVUpdate) {
        if (!this.fund?.baseToken || !this.fund?.fundToken) return 0;
        // If there was no NAV update, the exchange rate is 1:1 if the token0 decimals are the same as token1 decimals.
        // If decimals are the same, exchange rate will be 10^0 -> 1
        const decimalDiff =
          Number(this.fund?.fundToken.decimals) -
          Number(this.fund?.baseToken.decimals);
        return 10 ** -decimalDiff;
      }
      if (!this.fund.totalNAVWei || !this.fund?.fundTokenTotalSupply) return 0;

      // Create FixedNumber instances
      const totalNAV = FixedNumber.fromString(
        ethers.formatUnits(this.fund.totalNAVWei, this.fund.baseToken.decimals),
      );
      const fundTokenTotalSupply = FixedNumber.fromString(
        ethers.formatUnits(
          this.fund.fundTokenTotalSupply,
          this.fund.fundToken.decimals,
        ),
      );

      // Perform the division
      return Number(totalNAV.div(fundTokenTotalSupply));
    },
    fundToBaseTokenExchangeRate(): number {
      if (!this.fund?.baseToken?.decimals || !this.fund?.fundToken?.decimals)
        return 0;

      // If there was no NAV update yet, the exchange rate is 1:1
      // if (!this.fundLastNAVUpdate) {
      //   if (!this.fund?.baseToken || !this.fund?.fundToken) return 0;
      //   // If there was no NAV update, the exchange rate is 1:1 if the token0 decimals are the same as token1 decimals.
      //   // If decimals are the same, exchange rate will be 10^0 -> 1
      //   const decimalDiff = Number(this.fund?.fundToken.decimals) - Number(this.fund?.baseToken.decimals)
      //   return 10 ** decimalDiff;
      // }
      if (!this.fund?.totalNAVWei || !this.fund.fundTokenTotalSupply) return 0;

      const totalNAV = FixedNumber.fromString(
        ethers.formatUnits(this.fund.totalNAVWei, this.fund.baseToken.decimals),
      );
      const fundTokenTotalSupply = FixedNumber.fromString(
        ethers.formatUnits(
          this.fund.fundTokenTotalSupply,
          this.fund.fundToken.decimals,
        ),
      );
      return Number(fundTokenTotalSupply.div(totalNAV));
    },
    userCurrentValue(): bigint {
      /**
       * User current value (in base currency) is calculated as:
       * (totalNAV() * balanceOf(ownr)) / totalSupply();
       *
       * But if there are no NAV updates yet, we should take _totalDepositBal instead of totalNAV(), as totalNAV()
       * in the fund GovernableFund.sol contract is not updated yet, (_nav is zero).
       */
      // If any NAV update exists, we can just return the totalNAV value from the fund contract.
      if (this.fundLastNAVUpdate?.timestamp)
        return this.userFundShareValue || 0n;

      // There was no NAV update yet, we have to calculate the NAV with the totalDepositBalance.
      const fundTokenTotalSupply = this.fund?.fundTokenTotalSupply || 0n;
      if (!fundTokenTotalSupply) return 0n;
      return (
        (this.fundTotalNAV * this.userFundTokenBalance) / fundTokenTotalSupply
      );
    },
    fundTotalNAV(): bigint {
      /**
       * Total NAV is calculated in GovernableFund.sol as:
       * _nav
       * + IERC20(FundSettings.baseToken).balanceOf(address(this))
       * + IERC20(FundSettings.baseToken).balanceOf(FundSettings.safe)
       * - _feeBal
       *
       * But if there are no NAV updates yet, we should take _totalDepositBal instead to get a correct value.
       */
      // If any NAV update exists, we can just return the totalNAV value from the fund contract.
      if (this.fundLastNAVUpdate?.timestamp)
        return this.fund?.totalNAVWei || 0n;

      // There was no NAV update yet, we have to calculate the NAV with the totalDepositBalance.
      return this.fund?.totalDepositBalance || 0n;
    },
    fundTotalNAVFormattedShort(): string {
      if (!this.fund?.address) return "N/A";
      const totalNAV = Number(
        formatTokenValue(
          this.fundTotalNAV,
          this.fund?.baseToken.decimals,
          false,
        ),
      );
      return formatNumberShort(totalNAV) + " " + this.fund?.baseToken.symbol;
    },
    selectedFundSlug(state: IState): string {
      const chainId = this.web3Store?.chainId || "";
      return (
        chainId +
        "-" +
        (state.fund?.fundToken.symbol || "") +
        "-" +
        (state.fund?.address || "")
      );
    },
    fundLastNAVUpdate(state: IState): INAVUpdate | undefined {
      if (!state.fund?.navUpdates?.length) return undefined;
      return state.fund?.navUpdates[state.fund?.navUpdates?.length - 1];
    },
    fundLastNAVUpdateMethods(): INAVMethod[] {
      return this.fundLastNAVUpdate?.entries || [];
    },
    userDepositRequestExists(): boolean {
      return (this.userDepositRequest?.amount || 0) > 0;
    },
    userRedemptionRequestExists(): boolean {
      return (this.userRedemptionRequest?.amount || 0) > 0;
    },
    userFundSuggestedAllowance(): bigint {
      const userBaseTokenBalance = this.userBaseTokenBalance || 0n;
      const userDepositRequestAmount = this.userDepositRequest?.amount || 0n;
      return userBaseTokenBalance + userDepositRequestAmount;
    },
    userFundSuggestedAllowanceFormatted(): string {
      return ethers.formatUnits(
        this.userFundSuggestedAllowance,
        this.fund?.baseToken.decimals,
      );
    },
    isUserWalletWhitelisted(): boolean {
      // Return true if whitelisting is disabled. Anyone can deposit/redeem.
      if (!this.fund?.isWhitelistedDeposits) return true;

      const fundAllowedDepositAddresses = (
        this.fund?.allowedDepositAddresses || []
      ).map((address: string) => address.toLowerCase());
      return fundAllowedDepositAddresses.includes(
        this.activeAccountAddress?.toLowerCase() || "",
      );
    },
    shouldUserDelegate(): boolean {
      const nullAddress = "0x0000000000000000000000000000000000000000";
      // User should delegate if he has no delegate address set.
      return (
        this.userFundDelegateAddress === nullAddress ||
        !this.userFundDelegateAddress
      );
    },
    shouldUserRequestDeposit(): boolean {
      // User deposit request does not exist yet, he should request deposit.
      return !this.userDepositRequestExists;
    },
    shouldUserApproveAllowance(): boolean {
      // User deposit request exists and allowance is bigger.
      return (
        this.userDepositRequestExists &&
        this.userFundAllowance < (this.userDepositRequest?.amount || 0n)
      );
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
      )
        return false;
      // User deposit request exists and is valid, but there has to be at least 1 NAV update
      // made after the deposit was requested.
      return (
        this.userDepositRequest.timestamp < this.fundLastNAVUpdate?.timestamp
      );
    },
    shouldUserWaitSettlementOrCancelRedemption(): boolean {
      // If there was no NAV update yet, the user can process deposit request.
      // There is no need to wait until the next settlement.
      if (
        !this.fundLastNAVUpdate?.timestamp ||
        !this.userRedemptionRequest?.timestamp
      )
        return false;
      // User redemption request exists and is valid, but there has to be at least 1 NAV update
      // made after the redemption was requested.
      return (
        this.userRedemptionRequest.timestamp < this.fundLastNAVUpdate?.timestamp
      );
    },
    totalCurrentSimulatedNAV(): bigint {
      // Sum simulated NAV value of all methods.
      const totalNavMethodsSimulatedNAV = this.fundLastNAVUpdateMethods.reduce(
        (totalValue: bigint, method: any) => {
          return totalValue + (method.simulatedNav || 0n);
        },
        0n,
      );

      return (
        (totalNavMethodsSimulatedNAV || 0n) +
        (this.fund?.fundContractBaseTokenBalance || 0n) +
        (this.fund?.safeContractBaseTokenBalance || 0n) +
        (this.fund?.feeBalance || 0n)
      );
    },
    /**
     * Contracts
     */
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundFactoryContract(): Contract {
      const contractAddress =
        addresses[GovernableFundFactoryContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(
        GovernableFundFactory.abi,
        contractAddress,
      );
    },
    // @ts-expect-error: we should extend the return type as Contract<...>
    rethinkReaderContract(): Contract {
      const contractAddress =
        addresses[RethinkReaderContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(RethinkReader.abi, contractAddress);
    },
    // @ts-expect-error: we should extend the return type as Contract<...>
    navCalculatorContract(): Contract {
      return new this.web3.eth.Contract(
        NAVCalculator.abi,
        this.web3Store.NAVCalculatorBeaconProxyAddress,
      );
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundContract(): Contract {
      return new this.web3.eth.Contract(
        GovernableFund.abi,
        this.selectedFundAddress,
      );
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundSafeContract(): Contract {
      return new this.web3.eth.Contract(
        GnosisSafeL2JSON.abi,
        this.fund?.safeAddress,
      );
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundGovernorContract(): Contract {
      return new this.web3.eth.Contract(
        RethinkFundGovernor.abi,
        this.fund?.governorAddress,
      );
    },
    // @ts-expect-error: we should extend the return type ...
    fundBaseTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund?.baseToken?.address);
    },
    // @ts-expect-error: we should extend the return type as Contract<...>...
    fundGovernanceTokenContract(): Contract {
      return new this.web3.eth.Contract(
        ERC20Votes.abi,
        this.fund?.governanceToken.address,
      );
    },
    getFormattedBaseTokenValue:
      (state) =>
        (
          value: any,
          shouldCommify: boolean = true,
          shouldroundToSignificantDecimals: boolean = false,
        ): string => {
          const baseSymbol = state.fund?.baseToken.symbol;
          const baseDecimals = state.fund?.baseToken.decimals;
          if (!baseDecimals) {
            return value;
          }

          const valueFormatted = value
            ? formatTokenValue(
              value,
              baseDecimals,
              shouldCommify,
              shouldroundToSignificantDecimals,
            )
            : "0";
          return valueFormatted + " " + baseSymbol;
        },
    getFormattedFundTokenValue:
      (state) =>
        (
          value: any,
          shouldCommify: boolean = true,
          shouldroundToSignificantDecimals: boolean = false,
        ): string => {
          const fundSymbol = state.fund?.fundToken.symbol;
          const fundDecimals = state.fund?.fundToken.decimals;
          if (!fundDecimals) {
            return value;
          }

          const valueFormatted = value
            ? formatTokenValue(
              value,
              fundDecimals,
              shouldCommify,
              shouldroundToSignificantDecimals,
            )
            : "0";
          return valueFormatted + " " + fundSymbol;
        },
  },
  actions: {
    // Proxy method to make callWithRetry accessible as this.callWithRetry
    callWithRetry(
      method: () => any,
      maxRetries: number = 1,
      extraIgnorableErrorCodes?: any[],
    ): any {
      return this.web3Store.callWithRetry(
        method,
        maxRetries,
        extraIgnorableErrorCodes,
      );
    },
    /**
     * Fetches all needed fund data..
     */
    async getFund(fundAddress: string) {
      this.selectedFundAddress = fundAddress;
      this.fund = undefined;
      this.fundManagedNAVMethods = [];

      try {
        this.fund = (await this.fetchFundData()) as IFund;
        console.log("fund: ", toRaw(this.fund));
      } catch (e) {
        console.error(`Failed fetching fund ${fundAddress} -> `, e);
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
      const settingsData = await this.callWithRetry(() =>
        this.fundContract.methods.getFundSettings().call(),
      );
      // TODO these 2 things can be fetched all at once async and even better along with other fund metadata, not here.
      const performancePeriod = await this.callWithRetry(() =>
        this.fundContract.methods.feePerformancePeriod().call(),
      );
      const managementPeriod = await this.callWithRetry(() =>
        this.fundContract.methods.feeManagePeriod().call(),
      );

      // Adding properties to the existing settingsData object
      settingsData.performancePeriod = performancePeriod;
      settingsData.managementPeriod = managementPeriod;

      // Process the fund settings with a method assumed to be available in the current scope
      const fundSettings: IFundSettings = this.parseFundSettings(settingsData);

      return await this.fetchFundMetadata(fundSettings);
    },
    async fetchFundNAVUpdates(): Promise<void> {
      return await useActionState(async () => {
        return await fetchFundNAVUpdatesAction();
      });
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
        fundSettings[detailKey] =
          typeof value === "bigint" ? value.toString() : value;
      });

      return fundSettings as IFundSettings;
    },
    parseClockMode(clockModeString: string): IClockMode {
      // Example clockModeString:
      //   - "mode=blocknumber&from=default"
      //   - "mode=timestamp"
      const params = new URLSearchParams(clockModeString);
      const mode = (params.get("mode") as ClockMode) || "";
      const from = params.get("from");

      if (!(mode in ClockModeMap)) {
        console.error(
          "Fund clock mode is not in valid options: ",
          mode,
          clockModeString,
        );
      }

      return {
        mode: ClockModeMap[mode],
        ...(from ? { from } : {}),
      } as IClockMode;
    },
    async fetchUserBalances() {
      return await useActionState(async () => {
        await fetchUserBalancesAction();
      });
    },
    fetchFundPendingDepositRedemptionBalance(): void {
      if (!this.fund) return;
      this.fund.pendingDepositBalanceError = false;
      this.fund.pendingRedemptionBalanceError = false;
      this.fund.pendingDepositBalanceLoading = true;
      this.fund.pendingRedemptionBalanceLoading = true;

      this.callWithRetry(() =>
        this.fundContract.methods.getCurrentPendingDepositBal().call(),
      )
        .then((value: any) => {
          if (this.fund) {
            this.fund.pendingDepositBalance = value;
          }
        })
        .catch((error: any) => {
          console.error(
            "failed fetching fund deposit requests balance.",
            error,
          );
          if (this.fund) {
            this.fund.pendingDepositBalanceError = true;
          }
        })
        .finally(() => {
          if (this.fund) {
            this.fund.pendingDepositBalanceLoading = false;
          }
        });
      this.callWithRetry(() =>
        this.fundContract.methods.getCurrentPendingWithdrawalBal().call(),
      )
        .then((value: any) => {
          if (this.fund) {
            this.fund.pendingRedemptionBalance = value;
          }
        })
        .catch((error: any) => {
          console.error(
            "failed fetching fund redemption requests balance.",
            error,
          );
          if (this.fund) {
            this.fund.pendingRedemptionBalanceError = true;
          }
        })
        .finally(() => {
          if (this.fund) {
            this.fund.pendingRedemptionBalanceLoading = false;
          }
        });
    },
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    async fetchFundMetadata(fundSettings: IFundSettings): Promise<IFund> {
      try {
        return await fetchFundMetadataAction(fundSettings);
      } catch (error) {
        console.error("Error loading fund metadata: ", error);
        throw error;
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
        });
      }

      return positionTypeCounts;
    },
    parseNAVMethod(
      index: number,
      navMethodData: Record<string, any>,
    ): INAVMethod {
      let description;
      const positionType =
        NAVEntryTypeToPositionTypeMap[navMethodData.entryType];

      try {
        if (navMethodData.description === "") {
          description = {};
        } else {
          description = JSON.parse(navMethodData.description ?? "{}");
        }
      } catch (error) {
        // Handle the error or rethrow it
        console.warn(
          "Failed to parse NAV entry JSON description string: ",
          error,
        );
      }

      // console.log("DETAILS raw 0 ", JSON.stringify(navMethodData, stringifyBigInt, 2))
      const details = cleanComplexWeb3Data(navMethodData);
      // console.log("DETAILS cleaned 1 ", JSON.stringify(details, null, 2))
      const detailsJson = formatJson(details);
      // console.log("DETAILS json 2 ", detailsJson)

      return {
        index,
        positionType,
        positionName: description?.positionName,
        valuationSource: description?.valuationSource,
        details,
        detailsJson,
        detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
      } as INAVMethod;
    },
    async fetchNavParts(
      navUpdatesLen: number,
      fundAddress: string,
    ): Promise<(INAVParts | undefined)[]> {
      // Important to know: nav update indices start with 1, not with 0.
      const promises: Promise<any>[] = Array.from(
        { length: navUpdatesLen },
        (_, index) =>
          this.accountStore.requestConcurrencyLimit(() =>
            this.callWithRetry(() =>
              this.navCalculatorContract.methods
                .getNAVParts(fundAddress, index + 1)
                .call(),
            ),
          ),
      );

      const navPartsPromises = await Promise.allSettled(promises);
      const parsedNavParts: (INAVParts | undefined)[] = [];
      navPartsPromises.forEach((navPartsResult, index) => {
        if (navPartsResult.status === "fulfilled") {
          const navParts: Record<string, any> = navPartsResult.value;
          parsedNavParts.push({
            baseAssetOIVBal: navParts.baseAssetOIVBal,
            baseAssetSafeBal: navParts.baseAssetSafeBal,
            feeBal: navParts.feeBal,
            totalNAV: navParts.totalNAV,
          } as INAVParts);
        } else {
          parsedNavParts.push(undefined);
          console.error(
            `Failed to fetch NAV parts ${index}:`,
            navPartsResult.reason,
          );
        }
      });
      console.log("NAV parts", parsedNavParts);

      return parsedNavParts;
    },
    async simulateCurrentNAV(): Promise<void> {
      /**
       * Simulate NAV for the fund last NAV update.
       */
      if (!this.web3Store.web3 || this.isNavSimulationLoading) return;
      this.isNavSimulationLoading = true;

      if (!this.fundsStore.allNavMethods?.length) {
        const fundsInfoArrays = await this.fundsStore.fetchFundsInfoArrays();

        // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
        // and make sure it is fetched before checking here with fundsStore.fetchAllNavMethods, and then we
        // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
        console.log("[CURRENT NAV] simulate fetch all nav methods");
        await this.fundsStore.fetchAllNavMethods(fundsInfoArrays);
      }
      console.log("[CURRENT NAV] START SIMULATE:");

      // Simulate all at once as many promises instead of one by one.
      const promises = [];

      for (const navEntry of this.fundLastNAVUpdateMethods) {
        promises.push(
          this.accountStore.requestConcurrencyLimit(() =>
            this.callWithRetry(
              () => this.fetchSimulatedNAVMethodValue(navEntry),
              1,
              // Do not retry internal errors (probably invalid NAV method), better to fail on 1st try.
              // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
              [-32603],
            ),
          ),
        );
      }
      const settled = await Promise.allSettled(promises);
      this.isNavSimulationLoading = false;
      console.log(
        "[CURRENT NAV] SIMULATE DONE:",
        this.isNavSimulationLoading,
        settled,
      );
    },
    async fetchSimulatedNAVMethodValue(navEntry: INAVMethod) {
      try {
        await fetchSimulatedNAVMethodValueAction(navEntry);
      } catch (error) {
        console.error("Error fetchSimulatedNAVMethodValueAction: ", error);
        throw error;
      }
    },
    async updateNavMethodPastNavValue(
      navMethodIndex: number,
      navMethod: INAVMethod,
      fundAddress: string,
    ) {
      // NOTE: Important to know, that this currently only works for the methods of the last NAV update.
      // Fetch NAV method cached past value.
      const calculatorMethod =
        PositionTypeToNAVCacheMethod[navMethod.positionType];

      navMethod.pastNavValue = undefined;
      navMethod.pastNavValueFormatted = undefined;
      navMethod.pastNavValueLoading = true;
      navMethod.pastNavValueError = false;
      try {
        const navCacheResult = await this.callWithRetry(() =>
          this.navCalculatorContract.methods[calculatorMethod](
            fundAddress,
            navMethodIndex,
          ).call(),
        );
        const pastNavValue = navCacheResult.reduce(
          (acc: bigint, val: bigint) => acc + val,
          0n,
        );
        navMethod.pastNavValue = pastNavValue;
        navMethod.pastNavValueFormatted =
          this.getFormattedBaseTokenValue(pastNavValue);
      } catch (error) {
        navMethod.pastNavValueError = true;
        console.error(
          `Failed to fetch NAV method last NAV value ${navMethodIndex}:`,
          navMethod,
          error,
        );
      }
      navMethod.pastNavValueLoading = false;
    },
    async parseFundNAVUpdates(
      dataNAV: any,
      fundAddress: string,
      fundContract: any,
    ): Promise<INAVUpdate[]> {
      const navUpdates = [] as INAVUpdate[];
      // Get number of NAV updates for each NAV type (liquid, illiquid, nft, composable), they should all
      // have the same length, so we just use the liquid key.
      const navUpdatesLen = dataNAV[PositionType.Liquid].length;
      console.warn("navUpdatesLen ", navUpdatesLen);

      const fundNavUpdateTimes = await this.callWithRetry(() =>
        fundContract.methods.getNavUpdateTime(1, navUpdatesLen + 1).call(),
      );
      console.warn("dataNAV ", dataNAV);

      // Get a list of NAV parts (total NAV, fees, OIV balance, safe balance) for each NAV update.
      const navParts = await this.fetchNavParts(navUpdatesLen, fundAddress);

      for (let i = 0; i < navUpdatesLen; i++) {
        const navTimestamp = Number(fundNavUpdateTimes[i] * 1000n);
        navUpdates.push({
          // NAV update indices start from 1, not from 0.
          index: i + 1,
          // If the datetime of the NAV update is available format it, otherwise just use the index (e.g. #2).
          date: fundNavUpdateTimes[i]
            ? formatDate(new Date(navTimestamp))
            : `#${(i + 1).toString()}}`,
          timestamp: navTimestamp,
          navParts: navParts[i],
          totalNAV: navParts[i]?.totalNAV,
          entries: [],
        });
      }

      // Fetch NAV JSON entries for each NAV update.
      const promises: Promise<any>[] = Array.from(
        { length: navUpdatesLen },
        (_, index) =>
          this.accountStore.requestConcurrencyLimit(() =>
            this.callWithRetry(() =>
              fundContract.methods.getNavEntry(index + 1).call(),
            ),
          ),
      );

      // Each NAV update has more entries.
      // Parse and store them to the NAV update entries.
      const navUpdatePromises = await Promise.allSettled(promises);

      // Process results
      navUpdatePromises.forEach((navUpdateResult, navUpdateIndex) => {
        if (navUpdateResult.status === "fulfilled") {
          const navMethods: Record<string, any>[] = navUpdateResult.value;
          // console.log("navMethods: ", navMethods);

          for (const [navMethodIndex, navMethod] of navMethods.entries()) {
            navUpdates[navUpdateIndex].entries.push(
              this.parseNAVMethod(navMethodIndex, navMethod),
            );
          }
        } else {
          console.error(
            `Failed to fetch NAV entry ${navUpdateIndex + 1}:`,
            navUpdateResult.reason,
          );
        }
      });

      // console.log("fundNavUpdateTimes ", fundNavUpdateTimes);
      // TODO use this code when reader contract is fixed
      // Fetch NAV JSON entries for each NAV update.
      // const navUpdates: Record<string, any>[][] = dataNAV.encodedNavUpdate.map(decodeNavUpdateEntry);
      //
      // // Process results
      // for (const [navUpdateIndex, navMethods] of navUpdates.entries()) {
      //   // TODO remove this if when reader contract is fixed.
      //   if (!navMethods.length) continue
      //   for (const [navMethodIndex, navMethod] of navMethods.entries()) {
      //     const parsedNavMethod = this.parseNAVMethod(navMethodIndex, navMethod);
      //     // TODO this is not ok
      //     // parsedNavMethod.pastNavValue = dataNAV[parsedNavMethod.positionType][navUpdateIndex]
      //     navUpdates[navUpdateIndex].entries.push(parsedNavMethod)
      //   }
      // }
      console.warn("navUpdates: ", navUpdates, navUpdatesLen);
      const lastNavUpdateNavMethods =
        navUpdates[navUpdates.length - 1]?.entries ?? [];
      console.log("lastNavUpdateNavMethods: ", lastNavUpdateNavMethods);
      lastNavUpdateNavMethods.forEach((navMethod, navMethodIndex) => {
        this.updateNavMethodPastNavValue(
          navMethodIndex,
          navMethod,
          fundAddress,
        );
      });
      return navUpdates;
    },
    /**
     * Fetches connected user's wallet balance of the fund base/denomination token.
     */
    async fetchUserBaseTokenBalance() {
      this.userBaseTokenBalance = BigInt("0");

      if (!this.fund?.baseToken?.address) {
        console.log("Fund baseToken.address is not set.");
        return;
      }
      if (!this.activeAccountAddress) {
        console.log("activeAccountAddress is not set.");
        return;
      }
      this.userBaseTokenBalance = await this.callWithRetry(() =>
        this.fundBaseTokenContract.methods
          .balanceOf(this.activeAccountAddress)
          .call(),
      );

      console.log(
        `user base token balance of ${this.fund?.baseToken?.symbol} is ${this.userBaseTokenBalance}`,
      );
      return this.userBaseTokenBalance;
    },
    /**
     * Fetch connected user's wallet balance of the fund token.
     */
    async fetchUserFundTokenBalance() {
      this.userFundTokenBalance = BigInt("0");

      if (!this.fund?.fundToken?.address) {
        console.log("Fund fundToken.address is not set.");
        return;
      }
      if (!this.activeAccountAddress) {
        console.log("activeAccountAddress is not set.");
        return;
      }
      this.userFundTokenBalance = await this.callWithRetry(() =>
        this.fundContract.methods.balanceOf(this.activeAccountAddress).call(),
      );

      console.log(
        `user fund token balance of ${this.fund?.fundToken?.symbol} is ${this.userFundTokenBalance}`,
      );
      return this.userFundTokenBalance;
    },
    /**
     * Fetch connected user's wallet balance of the fund governance token.
     */
    async fetchUserGovernanceTokenBalance() {
      this.userGovernanceTokenBalance = BigInt("0");

      if (!this.fund?.governanceToken?.address) {
        console.log("Fund governanceToken.address is not set.");
        return;
      }
      if (!this.activeAccountAddress) {
        console.log("activeAccountAddress is not set.");
        return;
      }
      this.userGovernanceTokenBalance = await this.callWithRetry(() =>
        this.fundGovernanceTokenContract.methods
          .balanceOf(this.activeAccountAddress)
          .call(),
      );

      console.log(
        `user governance token balance is ${this.userGovernanceTokenBalance} ${this.fund?.fundToken?.symbol}`,
      );
      return this.userGovernanceTokenBalance;
    },
    /**
     * Fetch connected user's wallet fund delegate address.
     */
    async fetchUserFundDelegateAddress() {
      this.userFundDelegateAddress = "";
      if (!this.fund?.governanceToken?.address) {
        console.log("Fund governanceToken.address is not set.");
        return;
      }
      if (!this.activeAccountAddress) {
        console.log("activeAccountAddress is not set.");
        return;
      }
      console.warn("FETCH userFundDelegateAddress");

      this.userFundDelegateAddress = await this.callWithRetry(() =>
        this.fundContract.methods.delegates(this.activeAccountAddress).call(),
      );
      console.warn(
        "FETCH userFundDelegateAddress",
        this.userFundDelegateAddress,
      );

      return this.userFundDelegateAddress;
    },
    /**
     * Fetch connected user's fund allowance.
     * Amount of tokens the fund is allowed to act with (transfer/deposit/withdraw...).
     */
    async fetchUserFundAllowance() {
      this.userFundAllowance = BigInt("0");
      if (!this.fund?.baseToken?.address) {
        console.log("Fund baseToken.address is not set.");
        return;
      }
      if (!this.activeAccountAddress)
        return console.error("Active account not found");

      this.userFundAllowance = await this.callWithRetry(() =>
        this.fundBaseTokenContract.methods
          .allowance(this.activeAccountAddress, this.selectedFundAddress)
          .call(),
      );

      console.log(
        `user fund allowance of ${this.fund?.baseToken?.symbol} is ${this.userFundAllowance}`,
      );
      return this.userFundAllowance;
    },
    /**
     * Fetch user's fund share value (denominated in base token).
     */
    async fetchUserFundShareValue() {
      this.userFundShareValue = BigInt("0");

      if (!this.activeAccountAddress)
        return console.error("Active account not found");

      if (!this.fund?.fundTokenTotalSupply) {
        // No tokens have been minted yet. No deposits have been made yet.
        return this.userFundShareValue;
      }
      let balanceWei = BigInt("0");
      try {
        balanceWei = await this.callWithRetry(() =>
          this.fundContract.methods.valueOf(this.activeAccountAddress).call(),
        );
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ",
          e,
        );
      }
      console.log("balanceWei user fund share value:", balanceWei);

      this.userFundShareValue = balanceWei;
      return this.userFundShareValue;
    },
    async fetchUserFundDepositRedemptionRequests() {
      if (!this.activeAccountAddress)
        return console.error("Active account not found");
      if (!this.fund?.address) return "";
      this.loadingUserFundDepositRedemptionRequests = true;
      const [depositRequestResult, redemptionRequestResult] =
        await Promise.allSettled(
          [
            () =>
              this.fetchUserFundTransactionRequest(FundTransactionType.Deposit),
            () =>
              this.fetchUserFundTransactionRequest(
                FundTransactionType.Redemption,
              ),
          ].map((fn) => this.accountStore.requestConcurrencyLimit(fn)),
        );

      // Extract the results or handle errors
      // TODO also if not fulfilled set that it had error and display error in place of the failed request
      const depositRequest =
        depositRequestResult.status === "fulfilled"
          ? depositRequestResult.value
          : undefined;
      const redemptionRequest =
        redemptionRequestResult.status === "fulfilled"
          ? redemptionRequestResult.value
          : undefined;
      this.userDepositRequest = depositRequest;
      this.userRedemptionRequest = redemptionRequest;

      this.loadingUserFundDepositRedemptionRequests = false;
    },
    async fetchUserFundTransactionRequest(
      fundTransactionType: FundTransactionType,
    ) {
      if (!this.activeAccountAddress) return undefined;
      if (!this.fund?.address) return undefined;
      const slotId = FundTransactionTypeStorageSlotIdxMap[fundTransactionType];

      // GovernableFundStorage.sol
      const userRequestAddress = getAddressMappingStorageKeyAtIndex(
        this.activeAccountAddress,
        slotId,
      );
      const userRequestTimestampAddress =
        incrementStorageKey(userRequestAddress);
      console.log("[FETCH REQUEST] AMOUNT", fundTransactionType);
      try {
        const amount = await this.callWithRetry(() =>
          this.web3Store.web3.eth.getStorageAt(
            this.fund?.address,
            userRequestAddress,
          ),
        );
        console.log(
          "[FETCH REQUEST] AMOUNT fetched",
          fundTransactionType,
          amount,
        );
        let amountWei: string | bigint = ethers.stripZerosLeft(amount);
        amountWei = amountWei === "0x" ? 0n : BigInt(amountWei);

        console.log("[FETCH REQUEST] fetch TS", fundTransactionType);
        const ts = await this.callWithRetry(() =>
          this.web3Store.web3.eth.getStorageAt(
            this.fund?.address,
            userRequestTimestampAddress,
          ),
        );
        console.warn("[FETCH REQUEST] TS", fundTransactionType, ts);
        let timestamp: string | number = ethers.stripZerosLeft(ts);
        timestamp = timestamp === "0x" ? 0 : Number(timestamp);

        return {
          amount: amountWei,
          timestamp,
          type: fundTransactionType,
        } as IFundTransactionRequest;
      } catch (e) {
        console.error(
          `Failed fetching deposit/withdrawal request ${this.fund?.address} slot: ${slotId}. -> `,
          e,
        );
      }

      return undefined;
    },
    async fetchFundContractBaseTokenBalance() {
      if (!this.activeAccountAddress) return;
      if (!this.fund?.address) return;

      this.fund.fundContractBaseTokenBalanceLoading = true;
      let balanceWei = BigInt("0");
      try {
        balanceWei = await this.callWithRetry(() =>
          this.fundBaseTokenContract.methods
            .balanceOf(this.fund?.address)
            .call(),
        );
        this.fund.fundContractBaseTokenBalanceError = false;
      } catch (e) {
        this.fund.fundContractBaseTokenBalanceError = true;
        console.error(
          "Failed fetching fetchFundBaseTokenBalance error. -> ",
          e,
        );
      }
      this.fund.fundContractBaseTokenBalance = balanceWei;
      this.fund.fundContractBaseTokenBalanceLoading = false;
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
      const safeModules = await this.callWithRetry(() =>
        this.fundSafeContract.methods
          .getModulesPaginated(startAddress, 10)
          .call(),
      );
      roleModAddress = safeModules[0][1];
      this.fundRoleModAddress[this.fund?.address ?? ""] = roleModAddress;
      return roleModAddress;
    },
    mergeNAVMethodsFromLocalStorage() {
      // TODO should do cached in local storage separately by chain: navUpdateEntries
      // TODO: this code is not the best, generally now only "deleted" property can change for each NAV method,
      //   and they way mutation happen here is not good, losing reactive references?
      const localStorageNAVUpdateEntries =
        getLocalStorageItem("navUpdateEntries");
      // if there are no NAV methods in local storage, save them

      if (!localStorageNAVUpdateEntries[this.selectedFundAddress]?.length) {
        // Merge NAV method changes from localStorage to the current fundManagedNAVMethods.
        localStorageNAVUpdateEntries[this.selectedFundAddress] =
          this.fundManagedNAVMethods;
        setLocalStorageItem("navUpdateEntries", localStorageNAVUpdateEntries);
      }

      // if there are NAV methods in local storage, assign them to the fundManagedNAVMethods.
      this.fundManagedNAVMethods =
        localStorageNAVUpdateEntries[this.selectedFundAddress] || [];
      this.refreshSimulateNAVCounter++;
    },
    async estimateGasFundFlowsCall(encodedFunctionCall: any) {
      return await this.web3Store.estimateGas({
        from: this.activeAccountAddress,
        to: this.fundContract.options.address,
        data: this.fundContract.methods
          .fundFlowsCall(encodedFunctionCall)
          .encodeABI(),
      });
    },
    async postUpdateNAV(): Promise<any> {
      return await useActionState(async () => {
        await postUpdateNAVAction();
      });
    },
  },
});


