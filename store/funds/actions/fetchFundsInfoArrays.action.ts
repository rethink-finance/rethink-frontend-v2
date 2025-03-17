// actions/fetchFundsInfoArrays.action.ts
import { useWeb3Store } from "~/store/web3/web3.store";
import { type ChainId } from "~/types/enums/chain_id";

export async function fetchFundsInfoArraysAction(
  chainId: ChainId,
): Promise<any[]> {
  const web3Store = useWeb3Store();

  const fundFactoryContract = web3Store.chainContracts[chainId]?.fundFactoryContract;
  if (!fundFactoryContract) {
    throw new Error(`No fund factory contract found for chainId: ${chainId}`);
  }

  const fundsLength = await web3Store.callWithRetry(
    chainId,
    () =>
      fundFactoryContract.methods.registeredFundsLength().call(),
  );
  return await web3Store.callWithRetry(
    chainId,
    () =>
      fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
  );
}
