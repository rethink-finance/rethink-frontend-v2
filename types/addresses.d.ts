import { ChainId } from "~/store/web3/networksMap";

export type IContractAddresses = Record<ChainId, string>;

export default interface IContractAddressesMap {
  [contractName: string]: IContractAddresses;
}
