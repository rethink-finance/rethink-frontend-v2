import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundDataAction = async (
  fundChainId: string,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

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
