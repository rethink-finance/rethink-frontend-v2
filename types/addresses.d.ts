interface IContractAddresses {
  [chainId: string]: string;
}

export default interface IAddresses {
  [contractName: string]: IContractAddresses;
}
