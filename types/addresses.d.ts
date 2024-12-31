export interface IContractAddresses {
  [chainId: string]: string;
}

export default interface IContractAddressesMap {
  [contractName: string]: IContractAddresses;
}
