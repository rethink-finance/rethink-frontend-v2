import { useGovernanceProposalsStore } from "../governance_proposals.store";
import { fetchBackendProposals } from "~/services/backend/governance";
import { fetchOnChainProposals } from "~/services/onchain/proposals";
import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ChainId } from "~/types/enums/chain_id";
import { ClockMode } from "~/types/enums/clock_mode";
import { DelegatesSource } from "~/types/enums/delegates_source";
import { hasRethinkSubgraph } from "~/types/enums/subgraph";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";

/**
 * Written straight onto state, not via a store action: this module and the
 * store import each other, and inside that cycle TypeScript only sees a
 * partially-inferred action list. State on IState resolves either way.
 */
export const setProposalsSource = (
  chainId: ChainId,
  fundAddress: string,
  source: DelegatesSource,
): void => {
  const governanceProposalStore = useGovernanceProposalsStore();
  if (!chainId || !fundAddress) return;

  governanceProposalStore.fundProposalsSource[chainId] ??= {};
  governanceProposalStore.fundProposalsSource[chainId][fundAddress] = source;
};

export const fetchGovernanceProposalsAction = async (): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const fundStore = useFundStore();
  const blockTimeStore = useBlockTimeStore();

  const fund = fundStore.fund;
  if (!fund) {
    return;
  }
  if (!fund?.governorAddress) {
    throw new Error("Governor address not found");
  }
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(fund.chainId);

  const roleModAddress = await fundStore.fetchRoleModAddress(fund.address); // TODO replace with fetchGovernableFund

  // Tier 1: the backend's precomputed on-chain index. It embeds the
  // per-proposal quorum inputs, so the whole per-timepoint RPC loop below is
  // skipped. Soft-fails to null, never throws.
  const backendSnapshot = await fetchBackendProposals(fund.chainId, fund.address);
  if (backendSnapshot?.proposals) {
    setProposalsSource(fund.chainId, fund.address, DelegatesSource.Backend);
    const mappedProposals = await Promise.all(
      backendSnapshot.proposals.map((proposal: any) =>
        _mapSubgraphProposalToProposal(
          proposal,
          // Declared `number` but consumed via BigInt()/Number() — the
          // subgraph path passes a runtime bigint here too.
          BigInt(proposal.totalSupply || "0") as unknown as number,
          blockTimeContext,
          fund?.governanceToken?.decimals || 18,
          BigInt(proposal.quorumNumerator || "0"),
          BigInt(backendSnapshot.quorumDenominator || "1"),
          blockTimeStore.getTimestampForBlock,
          fund?.clockMode?.mode as ClockMode,
          roleModAddress ?? "",
          fund?.safeAddress ?? "",
          fund?.address ?? "",
        ),
      ),
    );
    governanceProposalStore.storeProposals(fund.chainId, fund.address, mappedProposals);
    return mappedProposals;
  }
  // Tier 2: the subgraph, where one is deployed. HyperEVM has none, so there
  // it is skipped rather than tried and reported as a failure.
  if (hasRethinkSubgraph(fund.chainId)) {
    setProposalsSource(fund.chainId, fund.address, DelegatesSource.Subgraph);
    try {
      return await fetchProposalsFromSubgraph(
        fund,
        blockTimeContext,
        roleModAddress,
      );
    } catch (error) {
      console.warn(
        "Proposals subgraph unavailable, falling back to on-chain logs:",
        error,
      );
    }
  }

  // Tier 3: the governor's own event log. Slower than either index, but it is
  // the only tier that can distinguish "this vault has never been proposed
  // against" from "we could not read its history" — which is the whole reason
  // the note above the table exists.
  try {
    const onChain = await fetchOnChainProposals(
      fund.chainId,
      fund.governorAddress,
      fund?.governanceToken?.address ?? fund.address,
    );
    setProposalsSource(fund.chainId, fund.address, DelegatesSource.OnChain);

    const mappedProposals = await Promise.all(
      onChain.proposals.map((proposal: any) =>
        _mapSubgraphProposalToProposal(
          proposal,
          BigInt(
            onChain.points[proposal.proposalId]?.totalSupply || "0",
          ) as unknown as number,
          blockTimeContext,
          fund?.governanceToken?.decimals || 18,
          BigInt(onChain.points[proposal.proposalId]?.quorumNumerator || "0"),
          BigInt(onChain.quorumDenominator || "1"),
          blockTimeStore.getTimestampForBlock,
          fund?.clockMode?.mode as ClockMode,
          roleModAddress ?? "",
          fund?.safeAddress ?? "",
          fund?.address ?? "",
        ),
      ),
    );
    governanceProposalStore.storeProposals(
      fund.chainId,
      fund.address,
      mappedProposals,
    );
    return mappedProposals;
  } catch (error) {
    // No tier could answer. Whatever localForage hydrated stays visible; the
    // page shows a "couldn't refresh" note.
    setProposalsSource(fund.chainId, fund.address, DelegatesSource.Unavailable);
    throw error;
  }
};

const fetchProposalsFromSubgraph = async (
  fund: any,
  blockTimeContext: any,
  roleModAddress: string | undefined,
): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  const blockTimeStore = useBlockTimeStore();

  const quorumDenominator = await web3Store.callWithRetry(
    fund.chainId,
    () =>
      fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  );

  const fetchedProposals = await fetchSubgraphGovernorProposals(
    fund.chainId,
    {
      governorAddress: fund?.governorAddress,
    },
  );

  const proposalsWithPoints = fetchedProposals.map((proposal) => ({
    proposal,
    timepoint:
      fund?.clockMode?.mode === ClockMode.BlockNumber
        ? proposal.proposalCreated?.[0]?.transaction?.blockNumber
        : proposal.proposalCreated?.[0]?.timestamp,
    blockNumber: proposal.proposalCreated?.[0]?.transaction?.blockNumber,
  }));

  const uniquePoints = [
    ...new Set(
      proposalsWithPoints.map((p) =>
        JSON.stringify({
          timepoint: p.timepoint,
          blockNumber: p.blockNumber,
        }),
      ),
    ),
  ].map((str) => JSON.parse(str));

  const pointsDataMap = Object.fromEntries(
    await Promise.all(
      uniquePoints.map(async ({ timepoint, blockNumber }) => {
        const [quorumNumerator, totalSupply] = await Promise.all([
          web3Store.callWithRetry(
            fund.chainId,
            () =>
              fundStore.fundGovernorContract.methods
                .quorumNumerator(timepoint)
                .call(), // TODO
          ),
          web3Store.callWithRetry(
            fund.chainId,
            () =>
              fundStore.fundGovernanceTokenContract.methods
                .totalSupply()
                .call({ blockNumber }), // TODO
          ),
        ]);
        return [
          JSON.stringify({ timepoint, blockNumber }),
          { quorumNumerator, totalSupply },
        ];
      }),
    ),
  );

  const processedProposals = proposalsWithPoints.map(({ proposal, timepoint, blockNumber }) => {
    const key = JSON.stringify({ timepoint, blockNumber });
    const { quorumNumerator, totalSupply } = pointsDataMap[key];

    return _mapSubgraphProposalToProposal(
      proposal,
      totalSupply,
      blockTimeContext,
      fund?.governanceToken?.decimals || 18,
      quorumNumerator,
      quorumDenominator,
      blockTimeStore.getTimestampForBlock,
      fund?.clockMode?.mode as ClockMode,
      roleModAddress ?? "",
      fund?.safeAddress ?? "",
      fund?.address ?? "",
    );
  });

  const mappedProposals = await Promise.all(processedProposals);

  governanceProposalStore.storeProposals(
    fund.chainId,
    fund?.address,
    mappedProposals,
  );

  return mappedProposals;
};
