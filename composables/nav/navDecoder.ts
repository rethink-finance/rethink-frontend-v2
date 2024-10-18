import { Web3, type AbiInput } from "web3";
import { GovernableFund } from "~/assets/contracts/GovernableFund";

export const getNavUpdateEntryFunctionABI: AbiInput[] = (GovernableFund.abi.find(
  (func:any) => func.name === "getNavEntry" && func.type === "function",
) as any )?.outputs || [];


export const getNavPartsFunctionABI: AbiInput[] =
  (
    GovernableFund.abi.find(
      (func: any) => func.name === "getNAVParts" && func.type === "function",
    ) as any
  )?.outputs || [];

const web3 = new Web3();

export const decodeNavUpdateEntry = (encodedNavUpdate: string):Record<string, any>[] => {
  return web3.eth.abi.decodeParameters(
    getNavUpdateEntryFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
}

export const decodeNavParts = (
  encodedNavUpdate: string,
): Record<string, any>[] => {
  return web3.eth.abi.decodeParameters(
    getNavPartsFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
};
