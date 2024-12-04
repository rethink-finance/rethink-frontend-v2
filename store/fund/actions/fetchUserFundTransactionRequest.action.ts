import { ethers } from "ethers";
import { useFundStore } from "../fund.store";

import {
  FundTransactionTypeStorageSlotIdxMap,
  type FundTransactionType,
} from "~/types/enums/fund_transaction_type";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundTransactionRequestAction = async (
  fundTransactionType: FundTransactionType,
): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  const fundAddress = fundStore.fundAddress;
  const fundChainId = fundStore.fundChainId;
  const web3Provider = web3Store.chainProviders[fundChainId];

  if (!fundStore.activeAccountAddress) return undefined;
  if (!fundAddress) return undefined;
  const slotId = FundTransactionTypeStorageSlotIdxMap[fundTransactionType];

  // GovernableFundStorage.sol
  const userRequestAddress = getAddressMappingStorageKeyAtIndex(
    fundStore.activeAccountAddress,
    slotId,
  );
  const userRequestTimestampAddress = incrementStorageKey(userRequestAddress);
  console.log("[FETCH REQUEST] AMOUNT", fundTransactionType);
  try {
    // TODO use correct provider based on chainId
    const amount = await web3Store.callWithRetry(
      fundChainId,
      () =>
        web3Provider?.eth.getStorageAt(
          fundAddress,
          userRequestAddress,
        ),
    );
    console.log("[FETCH REQUEST] AMOUNT fetched", fundTransactionType, amount);
    let amountWei: string | bigint = ethers.stripZerosLeft(amount);
    amountWei = amountWei === "0x" ? 0n : BigInt(amountWei);

    console.log("[FETCH REQUEST] fetch TS", fundTransactionType);
    const ts = await web3Store.callWithRetry(
      fundChainId,
      () =>
        web3Provider?.eth.getStorageAt(
          fundAddress,
          userRequestTimestampAddress,
        ),
    );
    console.warn("[FETCH REQUEST] TS", fundTransactionType, ts);
    let timestamp: string | number = ethers.stripZerosLeft(ts);
    timestamp = timestamp === "0x" ? 0 : Number(timestamp) * 1000;

    return {
      amount: amountWei,
      timestamp,
      type: fundTransactionType,
    } as IFundTransactionRequest;
  } catch (e) {
    console.error(
      `Failed fetching deposit/withdrawal request ${fundAddress} slot: ${slotId}. -> `,
      e,
    );
  }

  return undefined;
};
