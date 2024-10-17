import { useFundStore } from "../fund.store";

export const postUpdateNAVAction = async (
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.loadingUpdateNav = true;
  try {
    const navExecutorAddr = fundStore.web3Store.NAVExecutorBeaconProxyAddress;

    if (!navExecutorAddr) {
      fundStore.toastStore.errorToast(
        "The NAV Executor address is not available for this network. Please contact the Rethink Finance support.",
      );
      fundStore.loadingUpdateNav = false;
      return;
    }
    // const [gasPrice, gasEstimate] = await this.web3Store.estimateGas(
    //   {
    //     from: this.activeAccountAddress,
    //     to: this.fundContract.options.address,
    //     data: this.fundContract.methods.executeNAVUpdate(navExecutorAddr).encodeABI(),
    //   },
    // );

    return await fundStore.callWithRetry(() =>
      fundStore.fundContract.methods
        .executeNAVUpdate(navExecutorAddr)
        .send({
          from: fundStore.activeAccountAddress,
          // maxPriorityFeePerGas: gasPrice,
          gasPrice: "",
        })
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
          fundStore.loadingUpdateNav = false;
        })
        .on("error", (error: any) => {
          console.log(error);
          fundStore.loadingUpdateNav = false;
          fundStore.toastStore.errorToast(
            "There has been an error. Please contact the Rethink Finance support.",
          );
        }),
    );
  } catch (error) {
    console.error("Error updating NAV: ", error);
    fundStore.loadingUpdateNav = false;
    fundStore.toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
  }
}
