import { ethers } from "ethers";


function remove0xPrefix(str: string): string {
  return str.startsWith("0x") ? str.slice(2) : str;
}

export function getAddressMappingStorageKeyAtIndex(addr: string, slotNo: number): string {
  const pos = remove0xPrefix(ethers.zeroPadValue(ethers.toBeHex(slotNo), 32));
  const key = remove0xPrefix(ethers.zeroPadValue(ethers.getAddress(addr), 32));
  const concatenated = key + pos;
  return ethers.keccak256("0x" + concatenated);
}

export function incrementStorageKey(storageKey: string): string {
  const storageKeyBigInt = BigInt(storageKey);
  const incrementedKey = storageKeyBigInt + BigInt(1);
  return "0x" + incrementedKey.toString(16);
}
