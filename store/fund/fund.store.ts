import { ethers, FixedNumber } from "ethers";
import { defineStore } from "pinia";

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

import { ERC20 } from "~/assets/contracts/ERC20";
import { ERC20Votes } from "~/assets/contracts/ERC20Votes";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { NAVCalculator } from "~/assets/contracts/NAVCalculator";
import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import type { Explorer } from "~/services/explorer";
import { useAccountStore } from "~/store/account/account.store";
import { fetchFundSettingsAction } from "~/store/fund/actions/fetchFundSettings.action";
import { useFundsStore } from "~/store/funds/funds.store";
import { networksMap } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IFundUserData from "~/types/fund_user_data";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import { fetchRoleModAddressAddressAction } from "~/store/fund/actions/fetchRoleModAddress.action";

interface IState {
  // chainFunds[chainId][fundAddress1] = fund1 : IFund
  chainFunds: Record<ChainId, Record<string, IFund | undefined>>;
  chainAddressSourceCode: Record<
    ChainId,
    Record<string, Record<string, any> | undefined>
  >;
  fundUserData: IFundUserData;
  userRedemptionRequest?: IFundTransactionRequest;
  selectedFundChain: ChainId;
  selectedFundAddress: string;
  // Fund NAV methods that user can manage and change, delete, add...
  fundManagedNAVMethods: INAVMethod[];
  fundInitialNAVMethods: INAVMethod[];
  // Cached roleMod addresses for each fund.
  fundRoleModAddress: Record<string, string>;
  refreshSimulateNAVCounter: number;
}

const DEFAULT_FUND_USER_DATA: IFundUserData = {
  baseTokenBalance: 0n,
  fundTokenBalance: 0n,
  governanceTokenBalance: 0n,
  fundAllowance: 0n,
  fundShareValue: 0n,
  fundDelegateAddress: "",
  depositRequest: undefined,
  redemptionRequest: undefined,
};

// combine funds and fund store and map address => fund state; why only store one fund details at a time
export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    chainFunds: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, IFund | undefined>>,
    chainAddressSourceCode: Object.fromEntries(
      Object.keys(networksMap).map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, Record<string, any> | undefined>>,
    fundUserData: structuredClone(DEFAULT_FUND_USER_DATA),
    selectedFundChain: ChainId.ETHEREUM,
    selectedFundAddress: "",
    fundManagedNAVMethods: [],
    fundInitialNAVMethods: [],
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
    fundAddress(): string {
      return this.fund?.address ?? this.selectedFundAddress ?? "";
    },
    fund(): IFund | undefined {
      return this.chainFunds?.[this.selectedFundChain]?.[
        this.selectedFundAddress
      ];
    },
    addressLabelMap(): Record<string, string> {
      const labels: Record<string, string> = {};
      if (this.fund?.safeAddress) {
        labels[this.fund.safeAddress] = this.fund?.title + " Safe";
      }
      if (this.fund?.address) {
        labels[this.fund.address] = this.fund?.title + " Vault";
      }
      return labels;
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
    userDepositRequest(): IFundTransactionRequest | undefined {
      return this.fundUserData.depositRequest;
    },
    userRedemptionRequest(): IFundTransactionRequest | undefined {
      return this.fundUserData.redemptionRequest;
    },
    userCurrentValue(): bigint {
      /**
       * User current value (in base currency) is calculated as:
       * (totalNAV() * balanceOf(ownr)) / totalSupply();
       *
       * But if there are no NAV updates yet, we should take _totalDepositBal instead of totalNAV(), as totalNAV()
       * in the fund GovernableFund.sol contract is not updated yet, (_nav is zero).
       */
      // If any NAV update exists, we can just return the totalNAV value from the admin contract.
      if (this.fundLastNAVUpdate?.timestamp)
        return this.fundUserData?.fundShareValue || 0n;

      // There was no NAV update yet, we have to calculate the NAV with the totalDepositBalance.
      const fundTokenTotalSupply = this.fund?.fundTokenTotalSupply || 0n;
      if (!fundTokenTotalSupply) return 0n;
      return (
        (this.fundTotalNAV * this.fundUserData?.fundTokenBalance || 0n) /
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
      // If any NAV update exists, we can just return the totalNAV value from the admin contract.
      if (this.fundLastNAVUpdate?.timestamp)
        return this.fund?.lastNAVUpdateTotalNAV || 0n;

      // There was no NAV update yet, we have to calculate the NAV with the totalDepositBalance.
      return this.fund?.totalDepositBalance || 0n;
    },
    fundTotalNAVFormattedShort(): string {
      if (!this.fund?.address) return "N/A";
      return this.getFormattedBaseTokenValue(this.fundTotalNAV)
    },
    selectedFundSlug(): string {
      return (
        (this.selectedFundChain || "") +
        "-" +
        (this.fund?.fundToken.symbol || "") +
        "-" +
        (this.fund?.address || "")
      );
    },
    fundLastNAVUpdate(): INAVUpdate | undefined {
      const fundNavUpdatesLength = this.fund?.navUpdates?.length;
      if (!fundNavUpdatesLength) return undefined;
      console.warn(
        "fundLastNAVUpdate",
        this.fund?.navUpdates[fundNavUpdatesLength - 1],
      );
      return this.fund?.navUpdates[fundNavUpdatesLength - 1];
    },
    fundLastNAVUpdateMethods(): INAVMethod[] {
      return this.fundLastNAVUpdate?.entries || [];
    },
    userDepositRequestExists(): boolean {
      return (this.fundUserData.depositRequest?.amount || 0) > 0;
    },
    userRedemptionRequestExists(): boolean {
      return (this.fundUserData.redemptionRequest?.amount || 0) > 0;
    },
    userFundSuggestedAllowance(): bigint {
      const userBaseTokenBalance = this.fundUserData?.baseTokenBalance || 0n;
      const userDepositRequestAmount = this.fundUserData.depositRequest?.amount || 0n;
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
        this.fundUserData?.fundDelegateAddress === ethers.ZeroAddress ||
        !this.fundUserData?.fundDelegateAddress
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
        (this.fundUserData?.fundAllowance || 0n) <
        (this.fundUserData.depositRequest?.amount || 0n)
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
        userDepositRequest.timestamp ${this.fundUserData.depositRequest?.timestamp}`,
      );
      if (
        !this.canUserProcessDeposit ||
        !this.fundLastNAVUpdate?.timestamp ||
        !this.fundUserData.depositRequest?.timestamp
      ) {
        return false;
      }
      // User deposit request exists and is valid, but there has to be at least 1 NAV update
      // made after the deposit was requested. If the time of the last NAV update is not bigger than user's request
      // timestamp, user should wait for next NAV update.
      return (
        this.fundUserData.depositRequest.timestamp >= this.fundLastNAVUpdate?.timestamp
      );
    },
    shouldUserWaitSettlementOrCancelRedemption(): boolean {
      // If there was no NAV update yet, the user can process deposit request.
      // There is no need to wait until the next settlement.
      console.log(
        `Should process withdraw: fundLastNAVUpdate.timestamp: ${this.fundLastNAVUpdate?.timestamp} 
        userDepositRequest.timestamp ${this.fundUserData.redemptionRequest?.timestamp}`,
      );
      if (
        !this.fundLastNAVUpdate?.timestamp ||
        !this.fundUserData.redemptionRequest?.timestamp
      )
        return false;
      // User redemption request exists and is valid, but there has to be at least 1 NAV update
      // made after the redemption was requested.
      return (
        this.fundUserData.redemptionRequest.timestamp >= this.fundLastNAVUpdate?.timestamp
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
    getFormattedBaseTokenValue:
      (state: IState) =>
        (
          value: any,
          shouldCommify: boolean = true,
          shouldRoundToSignificantDecimals: boolean = false,
          symbol?: string,
          decimals?: number,
        ): string => {
          // TODO: don't get from fund, pass it as a parameter instead
          const fund = state.chainFunds?.[state.selectedFundChain]?.[state.selectedFundAddress];
          const baseSymbol = symbol || fund?.baseToken?.symbol;
          const baseDecimals = decimals || fund?.baseToken?.decimals || 18;

          if (!baseDecimals) {
            return value;
          }

          const valueFormatted = value
            ? formatTokenValue(
              value,
              baseDecimals,
              shouldCommify,
              shouldRoundToSignificantDecimals,
            )
            : "0";

          if (!baseSymbol) {
            return valueFormatted;
          }

          return valueFormatted + " " + baseSymbol;
        },
    getFormattedFundTokenValue:
      (state: IState) =>
        (
          value: any,
          shouldCommify: boolean = true,
          shouldRoundToSignificantDecimals: boolean = false,
        ): string => {
          const fund = state.chainFunds?.[state.selectedFundChain]?.[state.selectedFundAddress];
          const fundSymbol = fund?.fundToken.symbol;
          const fundDecimals = fund?.fundToken.decimals;
          if (!fundDecimals) {
            return value;
          }

          const valueFormatted = value
            ? formatTokenValue(
              value,
              fundDecimals,
              shouldCommify,
              shouldRoundToSignificantDecimals,
            )
            : "0";
          return valueFormatted + " " + fundSymbol;
        },
    /**
     * Contracts
     */
    navCalculatorContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        NAVCalculator.abi,
        this.web3Store.NAVCalculatorBeaconProxyAddress,
      );
    },
    fundContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        GovernableFund.abi,
        this.selectedFundAddress,
      );
    },
    fundSafeContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        GnosisSafeL2JSON.abi,
        this.fund?.safeAddress,
      );
    },
    fundGovernorContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        RethinkFundGovernor.abi,
        this.fund?.governorAddress,
      );
    },
    fundBaseTokenContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        ERC20,
        this.fund?.baseToken?.address,
      );
    },
    fundGovernanceTokenContract(): any {
      return this.web3Store.getCustomContract(
        this.selectedFundChain,
        ERC20Votes.abi,
        this.fund?.governanceToken.address,
      );
    },
  },
  actions: {
    resetFundData(fundChainId: ChainId, fundAddress: string) {
      this.chainFunds[fundChainId][fundAddress] = undefined;
      this.fundUserData.depositRequest = undefined;
      this.fundUserData.redemptionRequest = undefined;
      this.fundManagedNAVMethods = [];
      this.fundInitialNAVMethods = [];
      this.fundRoleModAddress = {};
      this.fundUserData = structuredClone(DEFAULT_FUND_USER_DATA);
    },
    async fetchAddressSourceCode(
      chainId: ChainId,
      address: string,
    ): Promise<Record<string, any> | undefined> {
      if (!address) return;
      if (this.chainAddressSourceCode[chainId][address]) {
        return this.chainAddressSourceCode[chainId][address];
      }
      // console.log("Fetch target ABI action", chainId, address);

      const { $getExplorer } = useNuxtApp(); // ✅ Works here
      let explorer: Explorer;
      try {
        explorer = $getExplorer(chainId);
      } catch (error: any) {
        this.chainAddressSourceCode[chainId][address] = undefined;
        return undefined;
      }

      // Check if address is same as the fund address.
      if (address.toLowerCase() === this.fund?.address.toLowerCase()) {
        const governableFundSourceCode = {
          ContractName: this.fund.title + " (GovernableFund)",
          ABI: JSON.stringify(GovernableFund.abi),
        };
        this.chainAddressSourceCode[chainId][address] = governableFundSourceCode;
        return governableFundSourceCode;
      }
      try {
        const sourceCode = await explorer.sourceCode(address);
        // console.warn("sourceCode", sourceCode);
        if (sourceCode.Proxy === "0") {
          // Only save it if it's not a proxy.
          try {
            // Try fetching ERC20 token symbol, if it works, we will show token symbol as a label.
            const tokenContract = this.web3Store.getCustomContract(
              chainId,
              ERC20,
              address,
            );
            sourceCode.symbol = await tokenContract.methods.symbol().call();
          } catch {}
          // Save the source code
          this.chainAddressSourceCode[chainId][address] = sourceCode;
        }
        return sourceCode;
      } catch (error: any) {
        this.chainAddressSourceCode[chainId][address] = undefined;
        return undefined;
      }
    },
    async getAddressLabel(
      address: string,
      chainId?: ChainId,
    ): Promise<string | undefined> {
      if (!chainId) return undefined;
      if (this.addressLabelMap[address]) {
        return this.addressLabelMap[address];
      }
      if (this.fundsStore.chainAddressLabelMap[chainId]?.[address]) {
        return this.fundsStore.chainAddressLabelMap[chainId]?.[address];
      }

      const sourceCode = await this.fetchAddressSourceCode(chainId, address);
      // Return the ERC20 token symbol if it exists, else try returning contract name.
      if (sourceCode?.symbol) {
        let label = sourceCode?.symbol;
        if (sourceCode?.ContractName) {
          label += ` (${sourceCode.ContractName})`;
          return label;
        }
      }
      return sourceCode?.ContractName;
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
    fetchFundData(fundChainId: ChainId, fundAddress: string): Promise<void> {
      return useActionState("fetchFundDataAction", () =>
        fetchFundDataAction(fundChainId, fundAddress),
      );
    },
    fetchFundSettings(
      fundChainId: ChainId,
      fundAddress: string,
    ): Promise<IFundSettings> {
      return useActionState("fetchFundSettingsAction", () =>
        fetchFundSettingsAction(fundChainId, fundAddress),
      );
    },
    fetchFundNAVData(): Promise<void> {
      return useActionState("fetchFundNAVDataAction", () =>
        fetchFundNAVDataAction(),
      );
    },
    fetchUserFundData(chainId: ChainId, fundAddress: string) {
      return useActionState("fetchUserFundDataAction", () =>
        fetchUserFundDataAction(chainId, fundAddress),
      );
    },
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    fetchFundMetaData(
      fundChainId: ChainId,
      fundAddress: string,
    ): Promise<IFund> {
      return useActionState("fetchFundMetaDataAction", () =>
        fetchFundMetaDataAction(fundChainId, fundAddress),
      );
    },
    fetchFundPendingDepositRedemptionBalance(): void {
      if (!this.fund) return;
      this.fund.pendingDepositBalanceError = false;
      this.fund.pendingRedemptionBalanceError = false;
      this.fund.pendingDepositBalanceLoading = true;
      this.fund.pendingRedemptionBalanceLoading = true;

      this.web3Store
        .callWithRetry(this.selectedFundChain, () =>
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
      this.web3Store
        .callWithRetry(this.selectedFundChain, () =>
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
        fetchSimulateCurrentNAVAction(this.selectedFundChain, this.fundAddress),
      );
    },
    fetchSimulatedNAVMethodValue(
      fundChainId: ChainId,
      fundAddress: string,
      safeAddress: string,
      baseDecimals: number,
      baseSymbol: string,
      navEntry: INAVMethod,
      isFundNonInit: boolean = false,
    ) {
      return useActionState("fetchSimulatedNAVMethodValueAction", () =>
        fetchSimulatedNAVMethodValueAction(
          fundChainId,
          fundAddress,
          safeAddress,
          baseDecimals,
          baseSymbol,
          navEntry,
          isFundNonInit,
        ),
      );
    },
    parseFundNAVUpdates(
      chainId: ChainId,
      fundNAVData: any,
      fundAddress: string,
    ): Promise<INAVUpdate[]> {
      return useActionState("parseFundNAVUpdatesAction", () =>
        parseFundNAVUpdatesAction(chainId, fundNAVData, fundAddress),
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
      if (!this.fund?.address) return;

      this.fund.fundContractBaseTokenBalanceLoading = true;
      let balanceWei = BigInt("0");
      try {
        balanceWei = await this.web3Store.callWithRetry(
          this.selectedFundChain,
          () =>
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
    fetchRoleModAddress(fundAddress: string): Promise<string> {
      return useActionState("fetchRoleModAddressAddressAction", () =>
        fetchRoleModAddressAddressAction(fundAddress),
      );
    },
    postUpdateNAV(): Promise<any> {
      return useActionState("postUpdateNAVAction", () => postUpdateNAVAction());
    },
    calculateFundPerformanceMetrics(fund?: IFund) {
      return useActionState("calculateFundPerformanceMetricsAction", () =>
        calculateFundPerformanceMetricsAction(fund),
      );
    },
  },
});
