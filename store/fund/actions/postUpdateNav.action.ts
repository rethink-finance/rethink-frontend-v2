import { useFundStore } from "../fund.store";
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";

export const postUpdateNAVAction = async (): Promise<any> => {
  const fundStore = useFundStore();

  try {
    const navExecutorAddress = NAVExecutorBeaconProxyAddress(fundStore.selectedFundChain);

    if (!navExecutorAddress) {
      fundStore.toastStore.errorToast(
        "The NAV Executor address is not available for this network. Please contact the Rethink Finance support.",
      );
      return;
    }

    return await fundStore.fundContract
      .send("executeNAVUpdate", {}, navExecutorAddress)
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
            "The recalculation of vault NAV has Succeeded",
          );
        } else {
          fundStore.toastStore.errorToast(
            "The recalculation of vault NAV has failed. Please contact the Rethink Finance support.",
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
