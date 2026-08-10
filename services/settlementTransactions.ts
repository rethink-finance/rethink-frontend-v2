import type { ChainId } from "~/types/enums/chain_id";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  collectExplorerTransactions,
  createExplorerTransactionReader,
  type ExplorerTransactionReader,
} from "~/services/explorerTransactions";

/**
 * Finds the transaction behind each of a vault's settlements.
 *
 * Nothing indexes NAV updates directly: the vault emits no event for one, and
 * the subgraph only tracks depositor-driven flows, so there is no hash to read
 * off the update itself. What the vault does store is the block timestamp of
 * every update, and `updateNav` is only ever reached two ways — through the
 * roles module on the vault's Safe, or through the governor executing a passed
 * proposal. So the transaction is found the other way round: list what went
 * through those two contracts, keep the calls that mention this vault, and
 * match on the timestamp the vault recorded.
 *
 * The timestamp is the block's, so a match is exact rather than approximate,
 * and requiring the vault address in the calldata is what keeps a curator's
 * other business in the same second from being mistaken for a settlement.
 *
 * Whatever cannot be found stays unlinked. A chain may have no usable explorer
 * API, and a Safe that signs continuously can push a years-old settlement past
 * the page budget below; both leave the row exactly as it was before — a plain
 * timestamp, never a link to the wrong thing.
 */

/** Safe's linked-list sentinel; enumeration starts from it. */
const SAFE_MODULE_SENTINEL = "0x0000000000000000000000000000000000000001";

/** A Safe holds a handful of modules at most. */
const SAFE_MODULE_PAGE_SIZE = 10;

const SAFE_MODULES_ABI = [
  {
    inputs: [
      { internalType: "address", name: "start", type: "address" },
      { internalType: "uint256", name: "pageSize", type: "uint256" },
    ],
    name: "getModulesPaginated",
    outputs: [
      { internalType: "address[]", name: "array", type: "address[]" },
      { internalType: "address", name: "next", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Enough history for any vault that settles on a human schedule, and a stop for
 * the ones that do not. Paging ends as soon as it reaches past the oldest NAV
 * update, so a typical vault costs two or three requests.
 */
const MAX_PAGES = 8;

export interface SettlementTransactionLookup {
  /** Unix seconds of the NAV update -> hash of the transaction that made it. */
  [timestamp: number]: string;
}

const cache = new Map<string, Promise<SettlementTransactionLookup>>();

/**
 * The modules enabled on the vault's Safe. The roles module among them is what
 * every curator-signed NAV update passes through, whichever wallet signed it,
 * which is why this is asked of the chain rather than assembled from the
 * curator addresses the vault happens to list.
 */
const fetchSafeModules = async (
  chainId: ChainId,
  safeAddress: string,
): Promise<string[]> => {
  try {
    const safe = useWeb3Store().getCustomContract(
      chainId,
      SAFE_MODULES_ABI,
      safeAddress,
    );
    // web3 hands back the tuple both positionally and by output name.
    const result: any = await safe.methods
      .getModulesPaginated(SAFE_MODULE_SENTINEL, SAFE_MODULE_PAGE_SIZE)
      .call();
    return Array.from<string>(result?.[0] ?? result?.array ?? []);
  } catch (error) {
    console.warn("Could not read Safe modules", safeAddress, error);
    return [];
  }
};

/**
 * Everything one contract signed that names this vault, keyed by the second it
 * happened in — which is the second the vault would have recorded, had that
 * call been the settlement.
 */
const collectFrom = async (
  read: ExplorerTransactionReader,
  address: string,
  fundAddressWithout0x: string,
  oldestTimestamp: number,
): Promise<SettlementTransactionLookup> => {
  const transactions = await collectExplorerTransactions(read, address, {
    until: oldestTimestamp,
    maxPages: MAX_PAGES,
  });

  const found: SettlementTransactionLookup = {};
  for (const transaction of transactions) {
    // A reverted call updated nothing, so it is not the settlement.
    if (transaction.reverted) continue;
    if (!transaction.input.includes(fundAddressWithout0x)) continue;
    found[transaction.timestamp] = transaction.hash;
  }
  return found;
};

interface SettlementTransactionSources {
  /** The vault's Safe, whose roles module carries curator-signed updates. */
  safeAddress?: string;
  /** The governor, which carries updates that went through a vote. */
  governorAddress?: string;
  /** Fallback signers for when the Safe's modules cannot be read. */
  managerAddresses: string[];
  /** Unix seconds of the earliest NAV update; where paging can stop. */
  oldestTimestamp: number;
  etherscanApiKey: string;
}

/**
 * Returns undefined when there was nothing to ask — no explorer for the chain,
 * or no contract to look through yet — as opposed to an empty result, which
 * means the search ran and found nothing. Only the latter is worth remembering.
 */
const load = async (
  chainId: ChainId,
  fundAddress: string,
  values: SettlementTransactionSources,
): Promise<SettlementTransactionLookup | undefined> => {
  const read = createExplorerTransactionReader(
    chainId,
    values.etherscanApiKey,
  );
  if (!read) return undefined;

  const modules = values.safeAddress
    ? await fetchSafeModules(chainId, values.safeAddress)
    : [];

  const candidates = [
    values.governorAddress,
    ...modules,
    // Only if the Safe would not say: a curator's own history is a much longer
    // walk, and on a busy wallet it may not reach far enough back.
    ...(modules.length ? [] : values.managerAddresses),
  ];

  const sources = Array.from(
    new Set(
      candidates
        .filter((address): address is string => Boolean(address))
        .map((address) => address.toLowerCase()),
    ),
    // The vault is a module of its own Safe, and its own history is deposits
    // and redemptions rather than settlements.
  ).filter((address) => address !== fundAddress.toLowerCase());
  // The vault's own addresses arrive in stages, so this can run before there is
  // anything to look through. Saying so lets the caller ask again.
  if (!sources.length) return undefined;

  const fundAddressWithout0x = fundAddress.toLowerCase().replace(/^0x/, "");
  const perSource = await Promise.all(
    sources.map((source) =>
      collectFrom(read, source, fundAddressWithout0x, values.oldestTimestamp),
    ),
  );

  return Object.assign({}, ...perSource) as SettlementTransactionLookup;
};

/**
 * Cached per vault for the life of the page: settlements are historical, so the
 * only thing a repeat lookup can add is the newest update, which is not worth
 * re-walking a Safe's history for on every navigation.
 */
export const fetchSettlementTransactions = (
  chainId: ChainId,
  fundAddress: string,
  values: SettlementTransactionSources,
): Promise<SettlementTransactionLookup> => {
  const key = `${chainId}:${fundAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const request = load(chainId, fundAddress, values)
    .catch((error) => {
      // A missing link is a smaller problem than a card that fails to render.
      console.error("Failed to resolve settlement transactions", error);
      return undefined;
    })
    .then((lookup) => {
      // Only a search that actually ran is worth keeping; anything else would
      // pin an empty answer in place of the one a later call could get.
      if (!lookup) cache.delete(key);
      return lookup ?? {};
    });

  cache.set(key, request);
  return request;
};
