export default interface INetwork {
  chainId:  ChainId,
  chainName: string,
  chainNameLong?: string,
  chainShort: string,
  nativeCurrency: INativeCurrency,
  icon: IIcon,
  rpcUrls: string[],
  /**
   * The one RPC URL the app gives a wallet for this chain: what
   * wallet_addEthereumChain registers, what WalletConnect and Ledger sessions
   * read through, and what a person is told to paste when their wallet's own
   * node fails. A public node that any wallet can use, not the app's private
   * or paid ones in rpcUrls.
   */
  walletRpcUrl: string,
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
