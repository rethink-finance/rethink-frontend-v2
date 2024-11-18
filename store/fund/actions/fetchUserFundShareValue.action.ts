import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserFundShareValueAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();
  fundStore.fundUserData.fundShareValue = BigInt("0");

  if (!accountStore.activeAccountAddress)
    return console.error("Active account not found");

  if (!fundStore.fund?.fundTokenTotalSupply) {
    // No tokens have been minted yet. No deposits have been made yet.
    return fundStore.fundUserData.fundShareValue;
  }
  let balanceWei = BigInt("0");
  try {
    balanceWei = await fundStore.fundContract.methods
      .valueOf(accountStore.activeAccountAddress)
      .call();
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
