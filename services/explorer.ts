// src: https://github.com/gnosisguild/zodiac-modifier-roles-v1/blob/main/packages/app/src/utils/explorer.ts
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"
import { ethers, type JsonFragment, Interface, JsonRpcProvider } from "ethers";
import detectProxyTarget from "evm-proxy-detection"
import pLimit from "p-limit";
import type { ExplorerConfig } from "~/types/explorer";
import { configureAxios } from "~/services/http";
import type {
  IExplorerTokenTransfer,
  IExplorerTransaction,
  ITokenTransfer, ITransaction,
} from "~/types/ethereum";

// Make only 2 parallel requests at once.
const explorerApiLimit = pLimit(1)

export class Explorer {
  private readonly apiUrl: string
  private readonly apiKey?: string
  private httpClient: AxiosInstance | undefined
  private cache: LocalForage | undefined
  private provider: ethers.JsonRpcProvider

  constructor(config: ExplorerConfig, provider: JsonRpcProvider) {
    this.apiUrl = config.apiUrl
    this.apiKey = config.apiKey
    this.provider = provider
  }

  async abi(address: string): Promise<[JsonFragment[], string | null]> {
    const client = await this.getHttpClient()
    const response = await client.get<{ status: string; result: string }>(this.apiUrl, {
      params: {
        module: "contract",
        action: "getabi",
        address,
      },
    })

    if (response.data.status !== "1") {
      // could not fetch ABI
      // check if this is a proxy
      const proxyAddress = await this.detectProxyTarget(address)
      if (proxyAddress) return await this.abi(proxyAddress)

      // otherwise remove from cache so we can try again later
      this.removeResponseFromCache(response)
      throw new Error(response.data.result)
    }

    const json = JSON.parse(response.data.result) as JsonFragment[]

    if (looksLikeAProxy(json)) {
      const proxyAddress = await this.detectProxyTarget(address)
      if (proxyAddress) return await this.abi(proxyAddress)
    }

    // Return JSON ABI and final proxy resolved address.
    return [json, address]
  }

  async sourceCode(address: string): Promise<Record<string, any>> {
    const client = await this.getHttpClient()
    // First, fetch ABI only, as it is a faster call, less likely to fail.
    const [abiResponse, proxyAddress] = await explorerApiLimit(() => this.abi(address))
    // const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    // await sleep(300);
    const response = await explorerApiLimit(() =>
      client.get<{ status: string; result: string }>(this.apiUrl, {
        params: {
          module: "contract",
          action: "getsourcecode",
          address: proxyAddress || address,
        },
      }),
    )
    if (response.data.status !== "1") {
      // remove from cache so we can try again later
      this.removeResponseFromCache(response)
      throw new Error(response.data.result)
    }

    return response.data.result[0] as any;
  }

  /**
   * Fetches transactions for a specific wallet address starting from a given block
   * @param walletAddress The Ethereum wallet address to fetch transactions for
   * @param startBlock The block number to start fetching transactions from
   * @param endBlock The end block number to stop fetching transactions
   * @returns An array of transactions
   */
  async fetchWalletTransactions(
    walletAddress: string,
    startBlock: number,
    endBlock: number,
  ): Promise<ITransaction[]> {
    // Normalize wallet address
    const address = walletAddress.toLowerCase();
    const client = await this.getHttpClient()
    const response = await client.get<{ status: string; result: string }>(this.apiUrl, {
      params: {
        module: "account",
        action: "txlist",
        startblock: startBlock,
        endblock: endBlock,
        sort: "desc",
        address,
      },
    })
    if (response.data.status !== "1") {
      // remove from cache so we can try again later
      this.removeResponseFromCache(response)
      throw new Error(response.data.result)
    }

    const transactionsData: IExplorerTransaction[] = response.data.result as any;
    console.log("transactionsData data", transactionsData);

    // Process and return transactions
    return processExplorerTransactions(transactionsData, address);
  }

  /**
   * Fetches token transfers for a specific wallet address starting from a given block
   * @param walletAddress The Ethereum wallet address to fetch token transfers for
   * @param startBlock The block number to start fetching token transfers from
   * @param endBlock The end block number to stop fetching transactions
   * @returns An array of token transfers
   */
  async fetchWalletTokenTransfers(
    walletAddress: string,
    startBlock: number,
    endBlock: number,
  ): Promise<ITokenTransfer[]> {
    // Normalize wallet address
    // const address = walletAddress.toLowerCase();
    //
    // // Fetch ERC-20 token transfers
    // const tokenTxUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${apiKey}`;
    //
    // let response;
    // try {
    //   response = await fetch(tokenTxUrl);
    //   if (!response.ok) {
    //     throw new Error(`HTTP error! status: ${response.status}`);
    //   }
    // } catch (fetchError: any) {
    //   throw new Error(`Network error: ${fetchError.message}`);
    // }
    //
    // const data: EtherscanTokenTransferResponse = await response.json();
    //
    // if (data.status !== "1" && data.message !== "No transactions found") {
    //   throw new Error(`Etherscan API error: ${data.message}`);
    // }

    // Process and return token transfers
    // return processExplorerTokenTransfers(data.result || [], address);
    return []
  }

  /**
   * Gets the block number for a given timestamp using binary search via RPC calls
   * @param timestamp Unix timestamp in seconds
   * @returns The block number closest to the given timestamp
   */
  async getBlockNumberFromTimestamp(timestamp: number): Promise<number> {
    const client = await this.getHttpClient()
    console.log("SHARE_PRICE getBlockNumberFromTimestamp", timestamp);
    // const timestampInSeconds = Math.floor(Date.now() / 1000);

    try {
      const response = await client.get(this.apiUrl, {
        params: {
          module: "block",
          action: "getblocknobytime",
          timestamp,
          closest: "after",
        },
      });
      console.log("SHARE_PRICE getBlockNumberFromTimestamp response", response);
      if (response.data.status === "1") {
        return parseInt(response.data.result);
      }
      throw new Error(`Etherscan API error: ${response.data.message}`);

    } catch (error) {
      console.error("Error fetching block number:", error);
      throw error;
    }
  }


  async detectProxyTarget(address: string): Promise<string | null> {
    const key = `proxyTarget:${address.toLowerCase()}`
    const cached = await this.cache?.getItem<{ target: string | null; timestamp: number }>(key)
    // Check cache age (24h expiry)
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.target
    }

    const res = await detectProxyTarget(
      address as `0x${string}`,
      ({ method, params }) => this.provider.send(method, params),
    )
    const target = res?.target as string | null

    await this.cache?.setItem(key, { target, timestamp: Date.now() })

    return target
  }

  private getHttpClientConfig(): AxiosRequestConfig {
    const params = this.apiKey ? { apikey: this.apiKey } : {}
    return {
      url: this.apiUrl,
      params,
    }
  }

  private async getHttpClient(): Promise<AxiosInstance> {
    if (!this.httpClient) {
      const { client, store } = await configureAxios(this.getHttpClientConfig())
      this.httpClient = client
      this.cache = store
    }
    return this.httpClient
  }

  private removeResponseFromCache<T>(response: AxiosResponse<T>) {
    if (!this.cache) return
    const params = new URLSearchParams(response.config.params)
    const url = `${response.config.url}?${params.toString()}`
    this.cache.removeItem(url)
  }
}

const looksLikeAProxy = (abi: JsonFragment[]) => {
  const iface = new Interface(abi)
  const signatures: string[] = [];
  iface.forEachFunction((func) => {
    signatures.push(func.selector);
  });
  return (
    signatures.length === 0 ||
    signatures ||
    looksLike(abi, ["implementation()"]) || // for EIP-897/EIP-1967/... proxies
    looksLike(abi, ["comptrollerImplementation()"]) // for Compound Comptroller
  )
}

const looksLike = (abi: JsonFragment[], expectedFunctions: string[]) => {
  const iface = new Interface(abi)
  // const signatures = Object.keys(iface.functions)
  // return expectedFunctions.every((sig) => signatures.includes(sig))
  return expectedFunctions.every((sig) => iface.hasFunction(sig))
}


/**
 * Processes raw Explorer (etherscan) transactions into our application's format
 */
function processExplorerTransactions(
  transactions: IExplorerTransaction[],
  walletAddress: string,
): ITransaction[] {
  return transactions
    .filter(tx => tx.isError === "0") // Filter out failed transactions
    .map(tx => {
      const isIncoming = tx.to.toLowerCase() === walletAddress.toLowerCase();

      return {
        hash: tx.hash,
        blockNumber: parseInt(tx.blockNumber),
        timestamp: parseInt(tx.timeStamp),
        from: tx.from,
        to: tx.to,
        value: tx.value,
        input: tx.input,
        gasPrice: tx.gasPrice,
        gasUsed: tx.gasUsed,
        isIncoming,
      };
    });
}

/**
 * Processes raw Explorer (etherscan) token transfers into our application's format
 */
function processExplorerTokenTransfers(
  tokenTransfers: IExplorerTokenTransfer[],
  walletAddress: string,
): ITokenTransfer[] {
  return tokenTransfers.map(transfer => {
    const isIncoming = transfer.to.toLowerCase() === walletAddress.toLowerCase();

    return {
      hash: transfer.hash,
      blockNumber: parseInt(transfer.blockNumber),
      timestamp: parseInt(transfer.timeStamp),
      from: transfer.from,
      to: transfer.to,
      value: transfer.value,
      tokenName: transfer.tokenName,
      tokenSymbol: transfer.tokenSymbol,
      tokenDecimals: parseInt(transfer.tokenDecimal),
      tokenContract: transfer.contractAddress,
      gasPrice: transfer.gasPrice,
      gasUsed: transfer.gasUsed,
      isIncoming,
    };
  });
}
