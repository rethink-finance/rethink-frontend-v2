export default interface INetwork {
  chainId:  string,
  chainName: string,
  chainShort: string,
  icon: IIcon,
  rpcUrl: string,
  rpcUrls?: string[],
}

export interface IIcon {
  name: string,
  size: string,
}