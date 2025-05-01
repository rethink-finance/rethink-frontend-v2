import { GovernableFund } from "assets/contracts/GovernableFund";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";
import type IFundInitCache from "~/types/fund_init_cache";


export const fetchFundSettingsAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<IFundInitCache> => {
  const web3Store = useWeb3Store();

  if (!fundChainId) {
    throw new Error("No fund chainId provided, cannot fetch fund settings.");
  }
  if (!fundAddress) {
    throw new Error("No fundAddress provided, cannot fetch fund settings.");
  }

  const fundContract = web3Store.getCustomContract(
    fundChainId,
    GovernableFund.abi,
    fundAddress,
  );

  console.log("GET fund settings")
  const fundSettings = await web3Store.callWithRetry(
    fundChainId,
    () =>
      fundContract.methods.getFundSettings().call(),
  );
  console.log("fund settings:", fundSettings)
  return fundSettings;
};
