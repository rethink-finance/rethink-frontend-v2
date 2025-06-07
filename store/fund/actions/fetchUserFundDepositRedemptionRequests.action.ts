import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundDepositRedemptionRequestsAction =
  async (): Promise<any> => {
    const fundStore = useFundStore();
    const web3Store = useWeb3Store();

    const fundAddress = fundStore.fundAddress;
    const fundChainId = fundStore.selectedFundChain;

    if (!fundStore.activeAccountAddress) return console.error("Active account not found");
    if (!fundAddress) return "";

    const rethinkReaderContract =
      web3Store.chainContracts[fundChainId]?.rethinkReaderContract;

    const transactionRequests = await web3Store.callWithRetry(
      fundChainId,
      () =>
        rethinkReaderContract.methods
          .getUserFundTransactionRequests(fundAddress, fundStore.activeAccountAddress)
          .call(),
    );
    console.warn("transactionRequests", transactionRequests)

    // Extract the results
    fundStore.fundUserData.depositRequest = {
      ...transactionRequests.depositRequest,
      settlementRates: transactionRequests.depositSettlementRates,
    };
    fundStore.fundUserData.redemptionRequest = {
      ...transactionRequests.withdrawalRequest,
      settlementRates: transactionRequests.withdrawalSettlementRates,
    };
  };
