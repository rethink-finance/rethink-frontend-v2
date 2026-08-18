import { ChainId } from "~/types/enums/chain_id";

/**
 * A contract's full event history, read from the block explorer rather than
 * over RPC.
 *
 * eth_getLogs is the wrong tool for this in a browser: every public RPC caps
 * the block range (1k on two of the three HyperEVM endpoints, 100k on the
 * third), and the deployment block is only reachable through archive state, so
 * a full-history scan means hundreds of sequential requests. Etherscan's V2 API
 * serves the same logs unbounded, one paged request at a time, and carries the
 * block timestamp with each entry — which the RPC does not, and which HyperEVM
 * will not serve separately (its own endpoint refuses eth_getBlockByNumber).
 */

/** Etherscan's V2 API takes the chain as a decimal id and one key for all. */
const ETHERSCAN_CHAIN_IDS: Partial<Record<ChainId, number>> = {
  [ChainId.ETHEREUM]: 1,
  [ChainId.POLYGON]: 137,
  [ChainId.ARBITRUM]: 42161,
  [ChainId.HYPEREVM]: 999,
};

const ETHERSCAN_API_URL = "https://api.etherscan.io/v2/api";

/** The logs endpoint's ceiling per request; asking for more returns this. */
const PAGE_SIZE = 1000;

/** Refuse to page forever if an explorer ignores the cursor. */
const MAX_PAGES = 20;

const REQUEST_TIMEOUT_MS = 20_000;

/** Five requests a second on the free plan, and a vault page asks for more. */
const RATE_LIMIT_ATTEMPTS = 4;
const RATE_LIMIT_BACKOFF_MS = 900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One log, with the hex fields the explorer returns already decoded. */
export interface ExplorerLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  /** Unix seconds — the explorer carries it, so no block lookup is needed. */
  timestamp: number;
  logIndex: number;
  transactionHash: string;
}

/**
 * Thrown when no explorer covers the chain, or the one that does could not
 * answer. Callers must surface this as "we could not read this" rather than as
 * an empty history — the two are indistinguishable otherwise, and presenting a
 * failed read as "nothing here" is the bug this whole path exists to avoid.
 */
export class ExplorerLogsUnavailableError extends Error {
  constructor(chainId: ChainId, cause?: unknown) {
    super(
      `No block explorer could serve the log history for chain ${chainId}. ` +
      "Etherscan's V2 API covers Ethereum, Polygon, Arbitrum and HyperEVM and " +
      "needs ETHERSCAN_KEY to be set.",
    );
    this.name = "ExplorerLogsUnavailableError";
    this.cause = cause;
  }
}

const toNumber = (value: unknown): number => {
  const text = String(value ?? "");
  if (!text) return 0;
  return text.startsWith("0x") ? parseInt(text, 16) : Number(text);
};

/**
 * Every log a contract has emitted, oldest first.
 *
 * @param chainId - The chain the contract lives on
 * @param address - The contract to read
 * @param topic0 - Optional first topic to filter on; omit for every event
 * @throws ExplorerLogsUnavailableError when no explorer could answer
 */
export const fetchExplorerLogs = async (
  chainId: ChainId,
  address: string,
  topic0?: string,
): Promise<ExplorerLog[]> => {
  const explorerChainId = ETHERSCAN_CHAIN_IDS[chainId];
  const apiKey = String(useRuntimeConfig().public.ETHERSCAN_KEY ?? "");
  if (!explorerChainId || !apiKey) throw new ExplorerLogsUnavailableError(chainId);

  const logs: ExplorerLog[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({
      chainid: String(explorerChainId),
      module: "logs",
      action: "getLogs",
      address,
      fromBlock: "0",
      toBlock: "latest",
      page: String(page),
      offset: String(PAGE_SIZE),
      apikey: apiKey,
    });
    if (topic0) query.set("topic0", topic0);

    // Everything Etherscan cannot answer comes back as a string result — a
    // rate limit, an unsupported chain, an address it has nothing for. Only
    // the first is worth waiting out; "No records found" is a real answer.
    let data: any;
    let lastError: unknown;
    for (let attempt = 0; attempt < RATE_LIMIT_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(`${ETHERSCAN_API_URL}?${query}`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        data = response.ok ? await response.json() : undefined;
      } catch (error) {
        lastError = error;
        data = undefined;
      }
      if (Array.isArray(data?.result)) break;
      if (/no records found/i.test(String(data?.result ?? ""))) return logs;
      if (!/rate limit/i.test(String(data?.result ?? ""))) break;
      await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
    }

    if (!Array.isArray(data?.result)) {
      // A failed first page is a failed read. A failed later page would mean
      // silently truncating history, which is the same lie — so is one too.
      throw new ExplorerLogsUnavailableError(chainId, lastError ?? data?.result);
    }

    logs.push(
      ...data.result.map((item: any) => ({
        address: String(item.address ?? "").toLowerCase(),
        topics: (item.topics ?? []).filter(Boolean),
        data: String(item.data ?? "0x"),
        blockNumber: toNumber(item.blockNumber),
        timestamp: toNumber(item.timeStamp),
        logIndex: toNumber(item.logIndex),
        transactionHash: String(item.transactionHash ?? ""),
      })),
    );

    if (data.result.length < PAGE_SIZE) break;
  }

  // The explorer returns ascending block order, but not every one guarantees
  // ordering within a block, so sort explicitly — the folds downstream are
  // last-write-wins and depend on it.
  return logs.sort(
    (a, b) =>
      a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
};
