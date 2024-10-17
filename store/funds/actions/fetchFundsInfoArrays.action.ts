import { useFundsStore } from "../funds.store";

export async function fetchFundsInfoArraysAction(): Promise<any> {
  const fundsStore = await useFundsStore();
  const fundFactoryContract = fundsStore.fundFactoryContract;
  const fundsLength = await fundsStore.callWithRetry(() =>
    fundFactoryContract.methods.registeredFundsLength().call(),
  );
  return await fundsStore.callWithRetry(() =>
    fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
  );
}
