import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const postUpdateNAVAction = async (): Promise<any> => {
  const web3Store = useWeb3Store();
  const fundStore = useFundStore();

  try {
    const navExecutorAddr = web3Store.NAVExecutorBeaconProxyAddress(fundStore.selectedFundChain);

    if (!navExecutorAddr) {
      fundStore.toastStore.errorToast(
        "The NAV Executor address is not available for this network. Please contact the Rethink Finance support.",
      );
      return;
    }

    return await fundStore.fundContract
      .send("executeNAVUpdate", {}, navExecutorAddr)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        fundStore.toastStore.warningToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log(receipt);
        if (receipt.status) {
          fundStore.toastStore.successToast(
            "The recalculation of OIV NAV has Succeeded",
          );
        } else {
          fundStore.toastStore.errorToast(
            "The recalculation of OIV NAV has failed. Please contact the Rethink Finance support.",
          );
        }
      })
      .on("error", (error: any) => {
        console.log(error);
        fundStore.toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
        throw error;
      });
  } catch (error) {
    console.error("Error updating NAV: ", error);
    fundStore.toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    throw error;
  }
};
