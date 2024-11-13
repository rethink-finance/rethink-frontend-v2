// actions/fetchFundsInfoArrays.action.ts
import { useWeb3Store } from "~/store/web3/web3.store";

export async function fetchFundsInfoArraysAction(
  chainId: string,
): Promise<any[]> {
  const web3Store = useWeb3Store();
  web3Store.chainId = chainId;

  const fundFactoryContract = web3Store.contracts[chainId]?.fundFactoryContract;
  if (!fundFactoryContract) {
    throw new Error(`No fund factory contract found for chainId: ${chainId}`);
  }

  const fundsLength = await web3Store.callWithRetry(() =>
    fundFactoryContract.methods.registeredFundsLength().call(),
  );
  return await web3Store.callWithRetry(() =>
    fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
  );
}
