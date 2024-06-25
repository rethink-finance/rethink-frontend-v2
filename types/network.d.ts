export default interface INetwork {
  chainId:  string,
  chainName: string,
  chainShort: string,
  maxPastEventsBlocksRange: number,
  rpcUrl: string,
  rpcUrls?: string[],
}
