import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchBackendDelegates } from "~/services/backend/governance";
import { fetchOnChainDelegates } from "~/services/onchain/delegates";
import { fetchSubgraphDelegates } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ChainId } from "~/types/enums/chain_id";
import { DelegatesSource } from "~/types/enums/delegates_source";
import { _mapSubgraphFetchDelegatesToDelegates } from "~/types/helpers/mappers";

/**
 * Written straight onto state rather than through a store action: this module
 * and the store import each other, and inside that cycle TypeScript only sees a
 * partially-inferred action list, so a new action here would not type-check.
 * State is declared explicitly on IState, so it resolves either way.
 */
const setDelegatesSource = (
  chainId: ChainId,
  fundAddress: string,
  source: DelegatesSource,
): void => {
  const governanceProposalStore = useGovernanceProposalsStore();
  if (!chainId || !fundAddress) return;

  governanceProposalStore.fundDelegatesSource[chainId] ??= {};
  governanceProposalStore.fundDelegatesSource[chainId][fundAddress] = source;
};

export const fetchDelegatesAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const governanceProposalStore = useGovernanceProposalsStore();

  const fund = unref(fundStore.fund);
  if (!fund) {
    return;
  }
  const votingContractAddress = fund?.governanceToken?.address;

  if (!votingContractAddress) {
    throw new Error("Governor token address not found");
  }

  // Tier 1: the backend's precomputed on-chain index — fastest and available
  // on chains whose subgraph is dead. Soft-fails to null, never throws.
  const backendSnapshot = await fetchBackendDelegates(fund.chainId, fund.address);
  if (backendSnapshot?.weight) {
    setDelegatesSource(fund.chainId, fund.address, DelegatesSource.Backend);
    const processedDelegates = _mapSubgraphFetchDelegatesToDelegates(
      backendSnapshot,
      fund?.governanceToken?.decimals || 18,
    );
    governanceProposalStore.storeDelegates(
      fund.chainId,
      fund.address,
      processedDelegates,
    );
    return backendSnapshot;
  }

  setDelegatesSource(fund.chainId, fund.address, DelegatesSource.Subgraph);

  let fetchedDelegates;
  try {
    fetchedDelegates = await fetchSubgraphDelegates(fund.chainId, {
      votingContract: votingContractAddress,
    });
  } catch (subgraphError) {
    // The subgraph is not merely slow here — deployments do go stale and stop
    // advancing without reporting an indexing error, which makes every vault
    // created after the freeze look like it has no delegates at all. Fall back
    // to reading the delegation graph off the governance token directly.
    console.warn(
      "Delegates subgraph unavailable, falling back to on-chain logs:",
      subgraphError,
    );
    try {
      fetchedDelegates = await fetchOnChainDelegates(
        fund.chainId,
        votingContractAddress,
      );
      setDelegatesSource(fund.chainId, fund.address, DelegatesSource.OnChain);
    } catch (onChainError) {
      setDelegatesSource(fund.chainId, fund.address, DelegatesSource.Unavailable);
      throw onChainError;
    }
  }

  const processedDelegates = _mapSubgraphFetchDelegatesToDelegates(
    fetchedDelegates,
    fund?.governanceToken?.decimals || 18,
  );
  governanceProposalStore.storeDelegates(
    fund?.chainId,
    fund?.address,
    processedDelegates,
  );
  return fetchedDelegates;
};
