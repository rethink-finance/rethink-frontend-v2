import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import type { ChainId } from "~/types/enums/chain_id";
import { isUserRejectionError } from "~/services/eip5792";
import {
  encodeReturnTransfer,
  RETURN_ROLE_ID_V1,
  RETURN_ROLE_KEY_V2,
  type ReturnRolesVersion,
} from "~/composables/onboarding/returnTestFundsCalls";

/** How the test-funds return reaches the vault, resolved by the step. */
export interface IReturnRoute {
  version: ReturnRolesVersion;
  rolesModAddress: string;
  factoryAddress: string;
  /**
   * Atomic: one wallet batch. Sequential: the same three calls as three
   * transactions, for wallets that cannot batch (Rabby, for one).
   */
  mode: "atomic" | "sequential";
}

/** How a plain send ended: mined and successful, reverted, or refused. */
export type SendOutcome = "confirmed" | "failed" | "rejected";

const SUBMITTED_TOAST =
  "The transaction has been submitted. Please wait for it to be confirmed.";

/**
 * The single transactions of the sequential return, shared by the step-by-step
 * modal and the card's "Remove permission" action.
 */
export const useReturnTransactions = () => {
  const toastStore = useToastStore();
  const accountStore = useAccountStore();
  const web3Store = useWeb3Store();
  const createFundStore = useCreateFundStore();

  /** Resolves once a CustomContract send has settled. Never rejects. */
  const settle = (transaction: any): Promise<SendOutcome> =>
    new Promise((resolve) => {
      Promise.resolve(
        transaction
          .on("transactionHash", () => toastStore.addToast(SUBMITTED_TOAST))
          .on("receipt", (receipt: any) =>
            resolve(receipt.status ? "confirmed" : "failed"),
          )
          .on("error", (error: any) => {
            console.error("test funds transaction error", error);
            resolve(isUserRejectionError(error) ? "rejected" : "failed");
          }),
      ).catch((error: any) => {
        console.error(error);
        resolve(isUserRejectionError(error) ? "rejected" : "failed");
      });
    });

  /** The wallet on the vault's chain, or false if switching failed. */
  const ensureChain = async (): Promise<boolean> => {
    const chainId = createFundStore.fundChainId as ChainId;
    if (chainId === accountStore.connectedWalletChainId) return true;
    try {
      await accountStore.switchNetwork(chainId);
      return true;
    } catch (error) {
      // switchNetwork has raised its own toast.
      console.error("Network switch failed before moving test funds", error);
      return false;
    }
  };

  /** factory.submitPermissions(entries) from the connected wallet. */
  const submitPermissions = (entries: string[]): Promise<SendOutcome> => {
    const factory = createFundStore.fundFactoryContract;
    if (!factory) return Promise.resolve("failed");
    return settle(factory.send("submitPermissions", {}, entries));
  };

  /** The Safe's transfer back to `recipient`, under the throwaway role. */
  const sendReturnTransfer = (
    route: IReturnRoute,
    tokenAddress: string,
    recipient: string,
    amount: bigint,
  ): Promise<SendOutcome> => {
    const roles = web3Store.getCustomContract(
      createFundStore.fundChainId as ChainId,
      route.version === "V1" ? (RolesFullV1 as any).abi : (RolesFullV2 as any).abi,
      route.rolesModAddress,
    );
    return settle(
      roles.send(
        "execTransactionWithRole",
        {},
        tokenAddress,
        0,
        encodeReturnTransfer(recipient, amount),
        0, // Operation.Call
        route.version === "V1"
          ? RETURN_ROLE_ID_V1
          : ethers.encodeBytes32String(RETURN_ROLE_KEY_V2),
        true,
      ),
    );
  };

  return { settle, ensureChain, submitPermissions, sendReturnTransfer };
};
