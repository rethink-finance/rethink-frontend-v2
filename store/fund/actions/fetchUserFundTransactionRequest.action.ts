import { ethers } from "ethers";
import { useFundStore } from "../fund.store";

import {
  FundTransactionTypeStorageSlotIdxMap,
  type FundTransactionType,
} from "~/types/enums/fund_transaction_type";
import type IFundTransactionRequest from "~/types/fund_transaction_request";

export const fetchUserFundTransactionRequestAction = async (
  fundTransactionType: FundTransactionType,
): Promise<any> => {
  const fundStore = useFundStore();

  if (!fundStore.activeAccountAddress) return undefined;
  if (!fundStore.fund?.address) return undefined;
  const slotId = FundTransactionTypeStorageSlotIdxMap[fundTransactionType];

  // GovernableFundStorage.sol
  const userRequestAddress = getAddressMappingStorageKeyAtIndex(
    fundStore.activeAccountAddress,
    slotId,
  );
  const userRequestTimestampAddress = incrementStorageKey(userRequestAddress);
  console.log("[FETCH REQUEST] AMOUNT", fundTransactionType);
  try {
    const amount = await fundStore.callWithRetry(() =>
      fundStore.web3Store.web3.eth.getStorageAt(
        fundStore.fund?.address,
        userRequestAddress,
      ),
    );
    console.log("[FETCH REQUEST] AMOUNT fetched", fundTransactionType, amount);
    let amountWei: string | bigint = ethers.stripZerosLeft(amount);
    amountWei = amountWei === "0x" ? 0n : BigInt(amountWei);

    console.log("[FETCH REQUEST] fetch TS", fundTransactionType);
    const ts = await fundStore.callWithRetry(() =>
      fundStore.web3Store.web3.eth.getStorageAt(
        fundStore.fund?.address,
        userRequestTimestampAddress,
      ),
    );
    console.warn("[FETCH REQUEST] TS", fundTransactionType, ts);
    let timestamp: string | number = ethers.stripZerosLeft(ts);
    timestamp = timestamp === "0x" ? 0 : Number(timestamp);

    return {
      amount: amountWei,
      timestamp,
      type: fundTransactionType,
    } as IFundTransactionRequest;
  } catch (e) {
    console.error(
      `Failed fetching deposit/withdrawal request ${fundStore.fund?.address} slot: ${slotId}. -> `,
      e,
    );
  }

  return undefined;
};
