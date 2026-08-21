import type { ChainId } from "~/types/enums/chain_id";
import {
  reconstructOpenRequests,
  type OpenRequest,
  type QueueFlow,
} from "~/composables/vaultOperations";
import { fetchSubgraphFundFlows, type FundFlow } from "~/services/subgraph";
import { fetchExplorerVaultFlows, type VaultFlow } from "~/services/vaultFlows";

/**
 * The vault's open deposit and redemption requests, per depositor — the same
 * two feeds the activity card merges (subgraph where deployed, explorer
 * everywhere), replayed by reconstructOpenRequests in vaultOperations.
 *
 * Best-effort by construction — a feed that missed a transaction leaves a
 * stale row — which is why the aggregate stats on the flows page read the
 * on-chain totals, and only the queue table reads the reconstruction.
 */

const toAmount = (value: string | null): bigint | null => {
  if (value == null) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/** Flows carry unix seconds; NAV updates arrive in milliseconds. */
const toSeconds = (timestamp: number) =>
  timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;

const subgraphToQueueFlow = (flow: FundFlow): QueueFlow => ({
  name: flow.name,
  amount: toAmount(flow.amount),
  flag: flow.flag,
  timestamp: toSeconds(parseInt(flow.timestamp, 10) || 0),
  from: flow.txFrom?.id,
  txHash: flow.transaction?.id,
});

const explorerToQueueFlow = (flow: VaultFlow): QueueFlow => ({
  name: flow.name,
  amount: toAmount(flow.amount),
  flag: flow.flag,
  timestamp: flow.timestamp,
  from: flow.from,
  txHash: flow.txHash,
});

/**
 * Both feeds see most transactions, so rows have to be deduplicated; the
 * subgraph decoded the call rather than inferring it from calldata and wins,
 * except that whichever source managed to decode the revoke argument keeps it.
 */
const mergeQueueFlows = (
  explorerFlows: QueueFlow[],
  subgraphFlows: QueueFlow[],
): QueueFlow[] => {
  const byTransaction = new Map<string, QueueFlow>();
  for (const flow of [...explorerFlows, ...subgraphFlows]) {
    if (!flow.txHash) continue;
    const key = `${flow.txHash.toLowerCase()}:${flow.name}`;
    const seen = byTransaction.get(key);
    byTransaction.set(key, {
      ...flow,
      flag: flow.flag ?? seen?.flag ?? null,
    });
  }
  return [...byTransaction.values()];
};

/**
 * The open requests of every depositor of one vault, from whichever of the
 * two feeds answer. Each feed failing on its own is ordinary (three chains
 * have no subgraph deployment; an explorer can be down) — the replay runs on
 * what arrived.
 */
export const fetchOpenRequests = async (
  chainId: ChainId,
  fundAddress: string,
  etherscanApiKey: string,
): Promise<OpenRequest[]> => {
  const [subgraph, explorer] = await Promise.all([
    fetchSubgraphFundFlows(chainId, { fundAddress, first: 1000, skip: 0 })
      .then((data) => data.items.map(subgraphToQueueFlow))
      .catch(() => [] as QueueFlow[]),
    fetchExplorerVaultFlows(chainId, fundAddress, etherscanApiKey).then(
      (flows) => flows.map(explorerToQueueFlow),
    ),
  ]);

  return reconstructOpenRequests(mergeQueueFlows(explorer, subgraph));
};
