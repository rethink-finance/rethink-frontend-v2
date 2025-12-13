import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

export const fetchUserFundDataAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<any> => {
  console.debug(
    "fetchUserFundDataAction, refresh user balances",
    fundChainId,
    fundAddress,
  );
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  fundStore.resetFundUserData();

  // Fetch user deposit & redemption requests async, no need to wait for it to finish.
  fundStore.fetchUserFundDepositRedemptionRequests();

  const rethinkReaderContract =
    web3Store.chainContracts[fundChainId]?.rethinkReaderContract;
  const activeAccountAddress = fundStore.activeAccountAddress;
  if (!activeAccountAddress || !rethinkReaderContract) return;

  const fundUserData = await web3Store.callWithRetry(
    fundChainId,
    () =>
      rethinkReaderContract.methods
        .getFundUserData(fundAddress, activeAccountAddress)
        .call(),
  );

  const {
    baseTokenBalance,
    fundTokenBalance,
    governanceTokenBalance,
    fundAllowance,
    fundShareValue,
    fundDelegateAddress,
  } = fundUserData;
  // TODO fundDelegateAddress has a bug if the governanceToken is different than the fundToken.
  //  if that's true, just manually fetch the delegate here instead of taking it from the reader, and remove this
  //  quickfix when it is changed in the reader contract to take the correct one
  if (fundStore.fund?.address !== fundStore.fund?.governanceToken.address) {
    fundStore.fundUserData.fundDelegateAddress = await web3Store.callWithRetry(
      fundChainId,
      () =>
        fundStore.fundGovernanceTokenContract.methods
          .delegates(fundStore.activeAccountAddress)
          .call(),
    );

    if (fundDelegateAddress !== fundStore.fundUserData.fundDelegateAddress) {
      console.warn(
        "[MISMATCH] wrong delegate to address from reader contract",
        fundDelegateAddress,
        "should be:",
        fundStore.fundUserData.fundDelegateAddress,
      )
    }
  } else {
    fundStore.fundUserData.fundDelegateAddress = fundDelegateAddress;
  }

  fundStore.fundUserData.baseTokenBalance = BigInt(baseTokenBalance);
  fundStore.fundUserData.fundTokenBalance = BigInt(fundTokenBalance);
  fundStore.fundUserData.governanceTokenBalance = BigInt(
    governanceTokenBalance,
  );
  fundStore.fundUserData.fundAllowance = BigInt(fundAllowance);
  fundStore.fundUserData.fundShareValue = BigInt(fundShareValue);
};
