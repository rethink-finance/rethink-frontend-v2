import { useFundStore } from "../fund.store";

import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserFundDepositRedemptionRequestsAction =
  async (): Promise<any> => {
    const fundStore = useFundStore();
    const accountStore = useAccountStore();

    if (!accountStore.activeAccountAddress)
      return console.error("Active account not found");
    if (!fundStore.fund?.address) return "";
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
    fundStore.userDepositRequest = depositRequest;
    fundStore.userRedemptionRequest = redemptionRequest;
  };
