import { ApolloClient, gql } from "@apollo/client/core";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Whether a subgraph is keeping up with its chain.
 *
 * A deployment that froze, was paused by its host, or is still syncing answers
 * queries without an error. Its answers are then complete only up to the block
 * it reached, so a caller that has another source should not take them.
 */

/** How far behind the chain an index may be and still be used. */
export const MAX_SUBGRAPH_LAG_SECONDS = 60 * 60;

/** How long one height check is reused before asking again. */
const CHECK_TTL_MS = 5 * 60 * 1000;

const SUBGRAPH_META = gql`
  query SubgraphMeta {
    _meta {
      block {
        number
        timestamp
      }
    }
  }
`;

/**
 * The decision on its own: fresh when the indexed block is no more than
 * `maxLagSeconds` old. Unknown time reads as stale, never as fresh.
 */
export const isIndexedBlockFresh = (
  indexedBlockTimestamp: number | null | undefined,
  nowSeconds: number,
  maxLagSeconds = MAX_SUBGRAPH_LAG_SECONDS,
): boolean =>
  typeof indexedBlockTimestamp === "number" &&
  indexedBlockTimestamp > 0 &&
  nowSeconds - indexedBlockTimestamp <= maxLagSeconds;

const lastCheck = new Map<string, { at: number; fresh: boolean }>();

/**
 * The Graph Studio reports the indexed block's timestamp in `_meta`; Goldsky
 * reports only its number, so the time is read off the chain instead.
 */
const indexedBlockTimestamp = async (
  chainId: ChainId,
  block: { number: number; timestamp?: number | null },
): Promise<number | null> => {
  if (block.timestamp) return Number(block.timestamp);
  const web3Store = useWeb3Store();
  const onChain = await web3Store.callWithRetry(chainId, () =>
    web3Store.chainProviders[chainId].eth.getBlock(block.number),
  );
  return onChain?.timestamp ? Number(onChain.timestamp) : null;
};

/**
 * Whether the chain's Rethink subgraph is fresh enough to answer for it.
 * Anything that stops the check from finishing reads as stale, which sends
 * callers to their next source rather than to a possibly frozen index.
 */
export const isRethinkSubgraphFresh = async (chainId: ChainId): Promise<boolean> => {
  const cached = lastCheck.get(chainId);
  if (cached && Date.now() - cached.at < CHECK_TTL_MS) return cached.fresh;

  let fresh = false;
  try {
    const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;
    const { data } = await client.query({ query: SUBGRAPH_META, fetchPolicy: "network-only" });
    const block = data?._meta?.block;
    if (block?.number) {
      const timestamp = await indexedBlockTimestamp(chainId, {
        number: Number(block.number),
        timestamp: block.timestamp,
      });
      fresh = isIndexedBlockFresh(timestamp, Math.floor(Date.now() / 1000));
    }
  } catch (error) {
    console.warn(`Could not check how far the ${chainId} subgraph has indexed`, error);
  }
  if (!fresh) console.warn(`The ${chainId} subgraph is behind the chain; using the next source`);
  lastCheck.set(chainId, { at: Date.now(), fresh });
  return fresh;
};
