// actions/fetchFundsInfoArrays.action.ts
import { useWeb3Store } from "~/store/web3/web3.store";
import { type ChainId } from "~/types/enums/chain_id";

export async function fetchFundsInfoArraysAction(
  chainId: ChainId,
): Promise<any[]> {
  const web3Store = useWeb3Store();

  const fundFactoryContract = web3Store.chainContracts[chainId]?.fundFactoryContract;
  const fundFactoryContractV2 = web3Store.chainContracts[chainId]?.fundFactoryContractV2;

  if (!fundFactoryContract) {
    throw new Error(`No fund factory contract found for chainId: ${chainId}`);
  }

  // Fetch data from the original contract
  const fundsLength = await web3Store.callWithRetry(
    chainId,
    () =>
      fundFactoryContract.methods.registeredFundsLength().call(),
  );
  const fundsData = await web3Store.callWithRetry(
    chainId,
    () =>
      fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
  );

  // If V2 contract exists, fetch data from it and merge results
  if (fundFactoryContractV2) {
    console.log("fundsV2 fetch length", chainId)
    try {
      const fundsLengthV2 = await web3Store.callWithRetry(
        chainId,
        () =>
          fundFactoryContractV2.methods.registeredFundsLength().call(),
      );

      if (fundsLengthV2 > 0) {
        const fundsDataV2 = await web3Store.callWithRetry(
          chainId,
          () =>
            fundFactoryContractV2.methods.registeredFundsData(0, fundsLengthV2).call(),
        );
        // TODO here we can add a property to each fund that fundFactoryContractV2Used is used

        // Merge the results from both contracts
        return [[...fundsData[0], ...fundsDataV2[0]], [...fundsData[1], ...fundsDataV2[1]]];
      }
    } catch (error) {
      console.warn(`Error fetching data from fundFactoryContractV2: ${error}`);
      // Continue with just the original contract data if V2 fails
    }
  }

  return fundsData;
}
