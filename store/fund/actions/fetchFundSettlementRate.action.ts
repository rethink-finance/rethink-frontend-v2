import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { parseBigintsToString } from "~/composables/fund/parseBigintsToString";

/**
  * struct SettlementRates {
  *     uint256 lpTokenRate;
  *     uint256 baseTokenRate;
  *     bool isSettled;
  * }
 */
export const fetchFundSettlementRatesAction = async (epoch: number): Promise<ISettlementRates | undefined> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  const { chainFundEpochRates, selectedFundChain, selectedFundAddress } = fundStore;

  fundStore.fundUserData.baseTokenBalance = BigInt("0");

  if (!fundStore.fund?.baseToken?.address) {
    console.log("Fund baseToken.address is not set.");
    return;
  }
  const rates = await web3Store.callWithRetry(
    selectedFundChain,
    () =>
      fundStore.fundContract.methods
        .settlementRates(epoch)
        .call(),
  );

  const parsedRates = parseBigintsToString(rates) as ISettlementRates;

  // ensure nested structure exists
  chainFundEpochRates[selectedFundChain] ??= {};
  chainFundEpochRates[selectedFundChain][selectedFundAddress] ??= {};

  // assign
  chainFundEpochRates[selectedFundChain][selectedFundAddress][epoch] = parsedRates;
  return parsedRates;
};
