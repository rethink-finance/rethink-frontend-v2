import { type AbiInput } from "web3";
import { decodeParameters } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { NAVCalculator } from "~/assets/contracts/NAVCalculator";

export const getNavUpdateEntryFunctionABI: AbiInput[] = (GovernableFund.abi.find(
  (func:any) => func.name === "getNavEntry" && func.type === "function",
) as any )?.outputs || [];


export const getNavPartsFunctionABI: AbiInput[] =
  (
    NAVCalculator.abi.find(
      (func: any) => func.name === "getNAVParts" && func.type === "function",
    ) as any
  )?.outputs || [];

export const decodeNavUpdateEntry = (encodedNavUpdate: string):Record<string, any>[] => {
  return decodeParameters(
    getNavUpdateEntryFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
}

export const decodeNavPart = (
  encodedNavUpdate: string,
): Record<string, any>[] => {
  return decodeParameters(
    getNavPartsFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
};
