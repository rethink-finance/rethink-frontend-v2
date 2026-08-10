import { ChainId, getBlockscoutApiUrl } from "~/types/enums/chain_id";

/**
 * Reading an address's transaction history from whichever block explorer covers
 * the chain, normalised so callers do not care which one answered.
 *
 * Two explorers because neither covers everything the app runs on: Etherscan's
 * multichain V2 API serves Ethereum, Polygon, Arbitrum and HyperEVM but refuses
 * Base on the free plan, and Blockscout serves Base well. Blockscout's Polygon
 * instance also sends no CORS headers, so it cannot be the browser's answer
 * there even when it is up.
 */

/** Etherscan's V2 API takes the chain as a decimal id and one key for all of them. */
const ETHERSCAN_CHAIN_IDS: Partial<Record<ChainId, number>> = {
  [ChainId.ETHEREUM]: 1,
  [ChainId.POLYGON]: 137,
  [ChainId.ARBITRUM]: 42161,
  [ChainId.HYPEREVM]: 999,
};

const ETHERSCAN_API_URL = "https://api.etherscan.io/v2/api";

/** The free plan's ceiling per request; asking for more silently returns this. */
const ETHERSCAN_PAGE_SIZE = 1000;

/** Blockscout ignores a requested page size and serves 50. */
const BLOCKSCOUT_PAGE_SIZE = 50;

/** Explorers are slow under load and every caller here can do without. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Etherscan's free plan allows five requests a second, and a vault page asks
 * for its flows and its settlements at once — enough to trip it. A rate limit
 * reads as an ordinary empty answer, so it has to be retried rather than
 * believed, or a vault silently shows no history at all.
 */
const RATE_LIMIT_ATTEMPTS = 4;
const RATE_LIMIT_BACKOFF_MS = 900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One transaction, reduced to what the callers here actually read. */
export interface ExplorerTransaction {
  hash: string;
  /** Unix seconds. */
  timestamp: number;
  /** Sender, lowercased. */
  from: string;
  /**
   * Recipient, lowercased. Empty on a contract creation, which has none — and
   * which is never one of the calls read here.
   */
  to: string;
  /** Calldata, lowercased. */
  input: string;
  reverted: boolean;
}

interface TransactionPage {
  transactions: ExplorerTransaction[];
  /** Cursor for the next page, or undefined when the history ends here. */
  nextCursor?: unknown;
}

/** Lists an address's transactions, newest first, one page at a time. */
export type ExplorerTransactionReader = (
  address: string,
  cursor: unknown,
) => Promise<TransactionPage | undefined>;

const getJson = async (url: string): Promise<any | undefined> => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch (error) {
    console.warn("Explorer transaction request failed", url, error);
    return undefined;
  }
};

const createEtherscanReader = (
  chainId: ChainId,
  apiKey: string,
): ExplorerTransactionReader | undefined => {
  const etherscanChainId = ETHERSCAN_CHAIN_IDS[chainId];
  if (!etherscanChainId || !apiKey) return undefined;

  return async (address, cursor) => {
    const page = typeof cursor === "number" ? cursor : 1;
    const query = new URLSearchParams({
      chainid: String(etherscanChainId),
      module: "account",
      action: "txlist",
      address,
      sort: "desc",
      page: String(page),
      offset: String(ETHERSCAN_PAGE_SIZE),
      apikey: apiKey,
    });

    // Everything Etherscan cannot answer comes back as a string result — a
    // rate limit, an unsupported chain, an address it has nothing for. Only the
    // first is worth waiting out.
    let data: any;
    for (let attempt = 0; attempt < RATE_LIMIT_ATTEMPTS; attempt++) {
      data = await getJson(`${ETHERSCAN_API_URL}?${query}`);
      if (Array.isArray(data?.result)) break;
      if (!/rate limit/i.test(String(data?.result ?? ""))) break;
      await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
    }
    if (!Array.isArray(data?.result)) return undefined;

    return {
      transactions: data.result.map((item: any) => ({
        hash: item.hash,
        timestamp: Number(item.timeStamp),
        from: String(item.from ?? "").toLowerCase(),
        to: String(item.to ?? "").toLowerCase(),
        input: String(item.input ?? "").toLowerCase(),
        reverted: item.isError === "1",
      })),
      nextCursor:
        data.result.length < ETHERSCAN_PAGE_SIZE ? undefined : page + 1,
    };
  };
};

const createBlockscoutReader = (
  chainId: ChainId,
): ExplorerTransactionReader | undefined => {
  const apiUrl = getBlockscoutApiUrl(chainId);
  if (!apiUrl) return undefined;

  return async (address, cursor) => {
    const pageParams = (cursor ?? {}) as Record<string, string | number>;
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(pageParams).map(([key, value]) => [key, String(value)]),
      ),
    );

    const data = await getJson(
      `${apiUrl}/api/v2/addresses/${address}/transactions?${query}`,
    );
    if (!Array.isArray(data?.items)) return undefined;

    return {
      transactions: data.items.map((item: any) => ({
        hash: item.hash,
        timestamp: Math.floor(Date.parse(item.timestamp) / 1000),
        from: String(item.from?.hash ?? "").toLowerCase(),
        to: String(item.to?.hash ?? "").toLowerCase(),
        input: String(item.raw_input ?? "").toLowerCase(),
        reverted: Boolean(item.result) && item.result !== "success",
      })),
      nextCursor:
        data.items.length < BLOCKSCOUT_PAGE_SIZE
          ? undefined
          : (data.next_page_params ?? undefined),
    };
  };
};

/**
 * The reader for a chain, or undefined when no explorer covers it. Etherscan
 * first wherever it reaches, because it pages twenty times deeper per request.
 */
export const createExplorerTransactionReader = (
  chainId: ChainId,
  etherscanApiKey: string,
): ExplorerTransactionReader | undefined =>
  createEtherscanReader(chainId, etherscanApiKey) ??
  createBlockscoutReader(chainId);

/**
 * Pages back through an address's history, newest first, stopping once it has
 * gone past `until` — so a caller that only cares about the last few months
 * pays for the last few months.
 */
export const collectExplorerTransactions = async (
  read: ExplorerTransactionReader,
  address: string,
  options: { until?: number; maxPages: number },
): Promise<ExplorerTransaction[]> => {
  const collected: ExplorerTransaction[] = [];
  let cursor: unknown;

  for (let page = 0; page < options.maxPages; page++) {
    const result = await read(address, cursor);
    if (!result?.transactions.length) break;

    let oldestOnPage = Infinity;
    for (const transaction of result.transactions) {
      if (Number.isNaN(transaction.timestamp)) continue;
      oldestOnPage = Math.min(oldestOnPage, transaction.timestamp);
      collected.push(transaction);
    }

    if (!result.nextCursor) break;
    if (options.until !== undefined && oldestOnPage <= options.until) break;
    cursor = result.nextCursor;
  }

  return collected;
};
