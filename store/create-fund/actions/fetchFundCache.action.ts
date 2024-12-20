import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";


export const fetchFundCacheAction = async (
  fundChainId: string,
  deployerAddress: string,
): Promise<any> => {
  const createFundStore = useCreateFundStore();
  const web3Store = useWeb3Store();

  if (!fundChainId) {
    throw new Error("No fund chainId provided, cannot fetch fund cache.");
  }
  if (!deployerAddress) {
    throw new Error("No deployerAddress provided, cannot fetch fund cache.");
  }
  const fundFactoryContract = web3Store.chainContracts[fundChainId]?.fundFactoryContract;

  createFundStore.fundInitCache = await web3Store.callWithRetry(
    fundChainId,
    () =>
      fundFactoryContract.methods.getFundInitializationCache(
        deployerAddress,
      ).call(),
  );
  console.log("fund init cache", createFundStore.fundInitCache);
};
