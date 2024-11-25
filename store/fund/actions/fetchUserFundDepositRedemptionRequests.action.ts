import { useFundStore } from "../fund.store";

import { FundTransactionType } from "~/types/enums/fund_transaction_type";

export const fetchUserFundDepositRedemptionRequestsAction =
  async (): Promise<any> => {
    const fundStore = useFundStore();

    if (!fundStore.activeAccountAddress) return console.error("Active account not found");
    if (!fundStore.selectedFundAddress) return "";
    console.log("fetchUserFundDepositRedemptionRequestsAction start")
    const [depositRequestResult, redemptionRequestResult] =
      await Promise.allSettled(
        [
          () =>
            fundStore.fetchUserFundTransactionRequest(
              FundTransactionType.Deposit,
            ),
          () =>
            fundStore.fetchUserFundTransactionRequest(
              FundTransactionType.Redemption,
            ),
        ].map((fn) => fundStore.accountStore.requestConcurrencyLimit(fn)),
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

    console.log("fetchUserFundDepositRedemptionRequestsAction done", depositRequest)
    fundStore.fundUserData.depositRequest = depositRequest;
    fundStore.fundUserData.redemptionRequest = redemptionRequest;
  };
