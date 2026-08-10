import type { ChainId } from "~/types/enums/chain_id";
import type ISubgraphFetchDelegatesResponse from "~/types/responses/subgraph_fetch_delegates";

/**
 * Snapshots served by the backend governance index (precomputed from on-chain
 * events). Shapes mirror the subgraph responses so the existing mappers work
 * unchanged; proposals additionally embed the per-proposal quorum inputs the
 * subgraph path has to fetch over RPC.
 */
export interface IBackendDelegatesSnapshot extends ISubgraphFetchDelegatesResponse {
  updatedAt: string;
}

export interface IBackendProposalsSnapshot {
  updatedAt: string;
  governorAddress: string;
  quorumDenominator: string;
  proposals: any[]; // ISubgraphGovernanceProposal + { quorumNumerator, totalSupply }
}

/**
 * Both fetchers soft-fail to null — the backend is tier 1 of the governance
 * data chain and a miss (down, 404 = not indexed yet, network error) must fall
 * through to the subgraph tier, never throw.
 */
const fetchBackendSnapshot = async (
  kind: "delegates" | "proposals",
  chainId: ChainId,
  fundAddress: string,
): Promise<any | null> => {
  const config = useRuntimeConfig();
  try {
    const response = await fetch(
      `${config.public.BACKEND_URL}/governance/${kind}/${fundAddress}?fundChainId=${chainId}`,
    );
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`[BACKEND] governance ${kind} fetch failed:`, response.statusText);
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`[BACKEND] governance ${kind} fetch error:`, error);
    return null;
  }
};

export const fetchBackendDelegates = (
  chainId: ChainId,
  fundAddress: string,
): Promise<IBackendDelegatesSnapshot | null> =>
  fetchBackendSnapshot("delegates", chainId, fundAddress);

export const fetchBackendProposals = (
  chainId: ChainId,
  fundAddress: string,
): Promise<IBackendProposalsSnapshot | null> =>
  fetchBackendSnapshot("proposals", chainId, fundAddress);
