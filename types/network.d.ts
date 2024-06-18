export default interface INetwork {
  chainId:  string,
  chainName: string,
  chainShort: string,
  rpcUrl: string,
  rpcUrls?: string[],
}
