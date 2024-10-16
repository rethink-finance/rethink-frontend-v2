import { type AbiInput } from "web3";
import { Web3 } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund";

export const getNavEntryFunctionABI: AbiInput[] = GovernableFund.abi.find(
  func => func.name === "getNavEntry" && func.type === "function",
)?.outputs || [];

const web3 = new Web3();

export const decodeNavUpdateEntry = (encodedNavUpdate: string):Record<string, any>[] => {
  return web3.eth.abi.decodeParameters(
    getNavEntryFunctionABI, encodedNavUpdate,
  )[0] as any[];
}
