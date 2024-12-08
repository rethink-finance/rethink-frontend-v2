import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundShareValueAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  fundStore.fundUserData.fundShareValue = BigInt("0");

  if (!fundStore.activeAccountAddress)
    return console.error("Active account not found");

  if (!fundStore.fund?.fundTokenTotalSupply) {
    // No tokens have been minted yet. No deposits have been made yet.
    return fundStore.fundUserData.fundShareValue;
  }
  let balanceWei = BigInt("0");
  try {
    balanceWei = await web3Store.callWithRetry(
      fundStore.fundChainId,
      () =>
        fundStore.fundContract.methods.valueOf(fundStore.activeAccountAddress).call(),
    );
  } catch (e) {
    console.error(
      "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ",
      e,
    );
  }
  console.log("balanceWei user fund share value:", balanceWei);

  fundStore.fundUserData.fundShareValue = balanceWei;
  return fundStore.fundUserData.fundShareValue;
};
