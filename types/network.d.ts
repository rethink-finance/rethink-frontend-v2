export default interface INetwork {
  chainId:  string,
  chainName: string,
  chainNameLong?: string,
  chainShort: string,
  nativeCurrency: INativeCurrency,
  icon: IIcon,
  rpcUrls: string[],
  blockExplorerUrls: string[],
}

export interface IIcon {
  name: string,
  size: string,
  color?: string,
}
export interface INativeCurrency {
  name: string,
  symbol: string,
  decimals: number,
}
