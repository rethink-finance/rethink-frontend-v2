import { ethers } from "ethers";
import { useFundStore } from "../fund.store";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { sendCuratorTransaction } from "~/composables/permissions/useCuratorExecution";

const fundIface = new ethers.Interface(GovernableFund.abi as any);

/**
 * Update NAV (and, on the flows page, settle) as the vault's curator.
 *
 * executeNAVUpdate is Safe authority, so the calldata is wrapped in the
 * vault's Roles modifier — a curator signs from their own wallet and the
 * modifier forwards the call as the Safe. A wallet connected as the Safe
 * itself still sends it unwrapped.
 */
export const postUpdateNAVAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();

  try {
    const navExecutorAddress = getNAVExecutorBeaconProxyAddress(fundStore.selectedFundChain);

    if (!navExecutorAddress) {
      fundStore.toastStore.errorToast(
        "The NAV Executor address is not available for this network. Please contact the Rethink Finance support.",
      );
      return;
    }

    const transaction = await sendCuratorTransaction({
      to: fundStore.fundAddress,
      data: fundIface.encodeFunctionData("executeNAVUpdate", [
        navExecutorAddress,
      ]),
    });

    return await transaction
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
  } catch (error: any) {
    console.error("Error updating NAV: ", error);
    // Roles pre-flight failures arrive here with the modifier's own reason —
    // surface it instead of the generic message, it is what tells the
    // curator which permission is missing.
    fundStore.toastStore.errorToast(
      error?.message ||
        "There has been an error. Please contact the Rethink Finance support.",
    );
    throw error;
  }
};
