import { ChainId } from "~/types/enums/chain_id";

export type IContractAddresses = Record<ChainId, string>;

export default interface IContractAddressesMap {
  [contractName: string]: IContractAddresses;
}
