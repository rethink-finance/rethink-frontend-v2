import { ethers } from "ethers";

/** storeNAVData(address oiv, bytes data) on the NAV executor. */
export const STORE_NAV_DATA_SELECTOR = "0xc8361853";

/**
 * The updateNav calldata a `storeNAVData(fund, data)` call carries, lowercase,
 * or null when the calldata is not a storeNAVData call.
 *
 * The NAV executor keeps a copy of the vault's NAV methods that the manager's
 * Update NAV replays, and a NAV-methods proposal stores that copy right after
 * it sets the vault's own list. To a reader the two calls look like the same
 * thing twice, so the proposal page needs to know when the copy is byte-for-
 * byte the list the proposal sets, and say so instead of repeating the table.
 */
export const innerNavCalldata = (calldata: string): string | null => {
  const data = String(calldata ?? "").toLowerCase();
  if (!data.startsWith(STORE_NAV_DATA_SELECTOR)) return null;
  try {
    const [, inner] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "bytes"],
      "0x" + data.slice(10),
    );
    return String(inner).toLowerCase();
  } catch {
    return null;
  }
};

/**
 * The index of the call in `calldatas` whose bytes the storeNAVData call at
 * `index` repeats, or -1 when it is not a storeNAVData call or no other call
 * carries the same bytes.
 */
export const findNavCopySource = (calldatas: string[], index: number): number => {
  const inner = innerNavCalldata(calldatas[index]);
  if (!inner) return -1;
  return calldatas.findIndex(
    (calldata, i) => i !== index && String(calldata ?? "").toLowerCase() === inner,
  );
};
