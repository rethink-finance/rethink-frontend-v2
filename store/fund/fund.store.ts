import { ethers, FixedNumber } from "ethers";
import { defineStore } from "pinia";
import { Web3 } from "web3";

import { useActionState } from "../actionState.store";
import { useToastStore } from "../toasts/toast.store";
import { calculateFundPerformanceMetricsAction } from "./actions/calculateFundPerformanceMetrics.action";
import { fetchFundDataAction } from "./actions/fetchFundData.action";
import { fetchFundMetaDataAction } from "./actions/fetchFundMetadata.action";
import { fetchFundNAVDataAction } from "./actions/fetchFundNAVData.action";
import { fetchSimulateCurrentNAVAction } from "./actions/fetchSimulateCurrentNAV.action";
import { fetchSimulatedNAVMethodValueAction } from "./actions/fetchSimulatedNAVMethodValue.action";
import { fetchUserBaseTokenBalanceAction } from "./actions/fetchUserBaseTokenBalance.action";
import { fetchUserFundAllowanceAction } from "./actions/fetchUserFundAllowance.action";
import { fetchUserFundDataAction } from "./actions/fetchUserFundData.action";
import { fetchUserFundDelegateAddressAction } from "./actions/fetchUserFundDelegateAddress.action";
import { fetchUserFundDepositRedemptionRequestsAction } from "./actions/fetchUserFundDepositRedemptionRequests.action";
import { fetchUserFundShareValueAction } from "./actions/fetchUserFundShareValue.action";
import { fetchUserFundTokenBalanceAction } from "./actions/fetchUserFundTokenBalance.action";
import { fetchUserFundTransactionRequestAction } from "./actions/fetchUserFundTransactionRequest.action";
import { fetchUserGovernanceTokenBalanceAction } from "./actions/fetchUserGovernanceTokenBalance.action";
import { parseFundNAVUpdatesAction } from "./actions/parseFundNAVUpdates.action";
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
import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IAddresses from "~/types/addresses";
import type IClockMode from "~/types/clock_mode";
import { ClockMode, ClockModeMap } from "~/types/enums/clock_mode";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IFundUserData from "~/types/fund_user_data";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const RethinkReaderContractName = "RethinkReader";

interface IState {
  fund?: IFund;
  fundUserData: IFundUserData;
  userDepositRequest?: IFundTransactionRequest;
  userRedemptionRequest?: IFundTransactionRequest;
  selectedFundAddress: string;
  // Fund NAV methods that user can manage and change, delete, add...
  fundManagedNAVMethods: INAVMethod[];
  // Cached roleMod addresses for each fund.
  fundRoleModAddress: Record<string, string>;
  refreshSimulateNAVCounter: number;
}

// combine funds and fund store and map address => fund state; why only store one fund details at a time
export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: undefined,
    fundUserData: {
      baseTokenBalance: 0n,
      fundTokenBalance: 0n,
      governanceTokenBalance: 0n,
      fundAllowance: 0n,
      fundShareValue: 0n,
      fundDelegateAddress: "",
    },
    userDepositRequest: undefined,
    userRedemptionRequest: undefined,
    selectedFundAddress: "",
    fundManagedNAVMethods: [],
    fundRoleModAddress: {},
    refreshSimulateNAVCounter: 0,
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
    fundChainId(): string {
      return this.fund?.chainId ?? "";
    },
    isUsingZodiacPilotExtension(): boolean {
      // Check if user is using Zodiac Pilot extension.
      // The connected wallet address is the same as custody (safe address).
      return (
        this.activeAccountAddress?.toLowerCase() ===
        this.fund?.safeAddress.toLowerCase()
      );
    },
    baseToFundTokenExchangeRate(): FixedNumber {
      if (!this.fund?.baseToken?.decimals || !this.fund?.fundToken?.decimals)
        return FixedNumber.fromString("0");

      // If there was any NAV update already, we use it to calculate the exchange rate.
      // If there was no NAV update yet, the exchange rate is 1:1.
      if (!this.fundLastNAVUpdate) {
        if (!this.fund?.baseToken || !this.fund?.fundToken)
          return FixedNumber.fromString("0");
        // If there was no NAV update, the exchange rate is 1:1 if the token0 decimals are the same as token1 decimals.
        if (this.fund?.fundToken.decimals === this.fund?.baseToken.decimals)
          return FixedNumber.fromString("1");
        // If decimals are not the same, we have to calculate it.
        const decimalDiff =
          Number(this.fund?.fundToken.decimals) -
          Number(this.fund?.baseToken.decimals);
        // For example:
        // Base Token: USDC has 6 decimals
        // Fund Token: ETH has 18 decimals
        // 18 - 6 = 12
        // '1000000000000' for 1e12
        let exp = FixedNumber.fromString(
          "1" + "0".repeat(Math.abs(decimalDiff)),
        );

        if (decimalDiff >= 0) {
          exp = FixedNumber.fromString("1").div(exp);
        }
        // This is now defined as ratio of 1 FUND token / x BASE tokens
        return exp;
      }
      if (!this.fundLastNAVUpdate.totalNAV || !this.fund?.fundTokenTotalSupply)
        return FixedNumber.fromString("0");

      // Create FixedNumber instances
      const totalNAV = FixedNumber.fromString(
        ethers.formatUnits(
          this.fundLastNAVUpdate.totalNAV,
          this.fund.baseToken.decimals,
        ),
      );
      // TODO get the fundTokenTotalSupply total supply from the last NAV update also!
      const fundTokenTotalSupply = FixedNumber.fromString(
        ethers.formatUnits(
          this.fund.fundTokenTotalSupply,
          this.fund.fundToken.decimals,
        ),
      );

      // Perform the division
      return fundTokenTotalSupply.div(totalNAV);
    },
    fundToBaseTokenExchangeRate(): FixedNumber {
      if (this.baseToFundTokenExchangeRate.eq(FixedNumber.fromString("0")))
        return this.baseToFundTokenExchangeRate;

      return FixedNumber.fromString("1").div(this.baseToFundTokenExchangeRate);
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
        return this.fundUserData.fundShareValue || 0n;

      // There was no NAV update yet, we have to calculate the NAV with the totalDepositBalance.
      const fundTokenTotalSupply = this.fund?.fundTokenTotalSupply || 0n;
      if (!fundTokenTotalSupply) return 0n;
      return (
        (this.fundTotalNAV * this.fundUserData.fundTokenBalance) /
        fundTokenTotalSupply
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
        return this.fund?.lastNAVUpdateTotalNAV || 0n;

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
      console.warn(
        "fundLastNAVUpdate",
        state.fund?.navUpdates[state.fund?.navUpdates?.length - 1],
      );
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
      const userBaseTokenBalance = this.fundUserData.baseTokenBalance || 0n;
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
      // User should delegate if he has no delegate address set.
      return (
        this.fundUserData.fundDelegateAddress === ethers.ZeroAddress ||
        !this.fundUserData.fundDelegateAddress
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
        this.fundUserData.fundAllowance <
          (this.userDepositRequest?.amount || 0n)
      );
    },
    canUserProcessDeposit(): boolean {
      // User deposit request exists and allowance is bigger.
      return !this.shouldUserRequestDeposit && !this.shouldUserApproveAllowance;
    },
    shouldUserWaitSettlementOrCancelDeposit(): boolean {
      // If there was no NAV update yet, the user can process deposit request.
      // There is no need to wait until the next settlement.
      console.log(
        `Should process deposit: fundLastNAVUpdate.timestamp: ${this.fundLastNAVUpdate?.timestamp} 
        userDepositRequest.timestamp ${this.userDepositRequest?.timestamp}`,
      );
      if (
        !this.canUserProcessDeposit ||
        !this.fundLastNAVUpdate?.timestamp ||
        !this.userDepositRequest?.timestamp
      ) {
        return false;
      }
      // User deposit request exists and is valid, but there has to be at least 1 NAV update
      // made after the deposit was requested. If the time of the last NAV update is not bigger than user's request
      // timestamp, user should wait for next NAV update.
      return (
        this.userDepositRequest.timestamp >= this.fundLastNAVUpdate?.timestamp
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
        const baseSymbol = state.fund?.baseToken?.symbol;
        const baseDecimals = state.fund?.baseToken?.decimals;
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
    resetFundData() {
      this.fund = undefined;
      this.userDepositRequest = undefined;
      this.userRedemptionRequest = undefined;
      this.fundManagedNAVMethods = [];
      this.fundRoleModAddress = {};
      this.fundUserData = {
        baseTokenBalance: 0n,
        fundTokenBalance: 0n,
        governanceTokenBalance: 0n,
        fundAllowance: 0n,
        fundShareValue: 0n,
        fundDelegateAddress: "",
      };
    },
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
    /**
     * Fetches multiple fund data:
     * - getFundSettings
     * - getFundStartTime
     * - fundMetadata
     *
     * @dev: would be better to separate fundSettings from (startTime & metadata), as sometimes we already
     *   have the fund settings from the discovery page.
     */
    fetchFundData(fundAddress: string): Promise<void> {
      return useActionState("fetchFundDataAction", () =>
        fetchFundDataAction(fundAddress),
      );
    },
    fetchFundNAVData(): Promise<void> {
      return useActionState("fetchFundNAVDataAction", () =>
        fetchFundNAVDataAction(),
      );
    },
    fetchUserFundData(fundAddress: string) {
      return useActionState("fetchUserFundDataAction", () =>
        fetchUserFundDataAction(fundAddress),
      );
    },
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    fetchFundMetaData(fundAddress: string): Promise<IFund> {
      return useActionState("fetchFundMetaDataAction", () =>
        fetchFundMetaDataAction(fundAddress),
      );
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
    simulateCurrentNAV(): Promise<void> {
      return useActionState("fetchSimulateCurrentNAVAction", () =>
        fetchSimulateCurrentNAVAction(this.fundChainId),
      );
    },
    fetchSimulatedNAVMethodValue(navEntry: INAVMethod) {
      return useActionState("fetchSimulatedNAVMethodValueAction", () =>
        fetchSimulatedNAVMethodValueAction(navEntry),
      );
    },
    parseFundNAVUpdates(
      fundNAVData: any,
      fundAddress: string,
    ): Promise<INAVUpdate[]> {
      return useActionState("parseFundNAVUpdatesAction", () =>
        parseFundNAVUpdatesAction(fundNAVData, fundAddress),
      );
    },
    fetchUserBaseTokenBalance() {
      return useActionState("fetchUserBaseTokenBalanceAction", () =>
        fetchUserBaseTokenBalanceAction(),
      );
    },
    fetchUserFundTokenBalance() {
      return useActionState("fetchUserFundTokenBalanceAction", () =>
        fetchUserFundTokenBalanceAction(),
      );
    },
    fetchUserGovernanceTokenBalance() {
      return useActionState("fetchUserGovernanceTokenBalanceAction", () =>
        fetchUserGovernanceTokenBalanceAction(),
      );
    },
    fetchUserFundDelegateAddress() {
      return useActionState("fetchUserFundDelegateAddressAction", () =>
        fetchUserFundDelegateAddressAction(),
      );
    },
    fetchUserFundAllowance() {
      return useActionState("fetchUserFundAllowanceAction", () =>
        fetchUserFundAllowanceAction(),
      );
    },
    fetchUserFundShareValue() {
      return useActionState("fetchUserFundShareValueAction", () =>
        fetchUserFundShareValueAction(),
      );
    },
    fetchUserFundDepositRedemptionRequests() {
      return useActionState(
        "fetchUserFundDepositRedemptionRequestsAction",
        () => fetchUserFundDepositRedemptionRequestsAction(),
      );
    },
    fetchUserFundTransactionRequest(fundTransactionType: FundTransactionType) {
      return useActionState("fetchUserFundTransactionRequestAction", () =>
        fetchUserFundTransactionRequestAction(fundTransactionType),
      );
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
    postUpdateNAV(): Promise<any> {
      return useActionState("postUpdateNAVAction", () => postUpdateNAVAction());
    },
    calculateFundPerformanceMetrics() {
      return useActionState("calculateFundPerformanceMetricsAction", () =>
        calculateFundPerformanceMetricsAction(),
      );
    },
  },
});
