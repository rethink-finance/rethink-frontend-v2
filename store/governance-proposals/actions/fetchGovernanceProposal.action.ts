import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposal } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ClockMode } from "~/types/enums/clock_mode";
import { ProposalStateMapping } from "~/types/enums/governance_proposal";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";

export const fetchGovernanceProposalAction = async (
  proposalId: string,
): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const fundStore = useFundStore();
  const nuxtApp = useNuxtApp();
  const client = nuxtApp.$apolloClient as Ref<ApolloClient<any>>;

  if (!client) {
    throw new Error("Apollo client not found");
  }
  if (!fundStore.fund?.governorAddress) {
    throw new Error("Governor address not found");
  }
  if (!proposalId) {
    throw new Error("Proposal ID not found");
  }
  // fetch the proposal from the subgraph
  const proposal = await fetchSubgraphGovernorProposal(client.value, {
    governorAddress: fundStore.fund?.governorAddress,
    proposalId,
  });
  const roleModAddress = await fundStore.getRoleModAddress();




  const totalSupply = await governanceProposalStore.callWithRetry(() =>
    fundStore.fundGovernanceTokenContract.methods
      .totalSupply()
      .call(
        {},
        proposal.proposalCreated?.[0]?.transaction?.blockNumber - 1,
      ),
  );
  const timePoint =
      fundStore.fund?.clockMode?.mode === ClockMode.BlockNumber
        ? proposal.proposalCreated?.[0]?.transaction?.blockNumber
        : Number(proposal.proposalCreated?.[0]?.timestamp);

  const quorumNumerator = await governanceProposalStore.callWithRetry(() =>
    fundStore.fundGovernorContract.methods
      .quorumNumerator(timePoint)
      .call());

  const quorumDenominator = await governanceProposalStore.callWithRetry(() =>
    fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  );

  const mappedProposal = _mapSubgraphProposalToProposal(
    proposal,
    governanceProposalStore.decodeProposalCallData.bind(
      governanceProposalStore,
    ),
    totalSupply,
    fundStore.fund?.governanceToken.decimals ?? 0,
    quorumNumerator,
    quorumDenominator,
    roleModAddress,
    fundStore.fund?.safeAddress,
  );
  const proposalState = await fundStore.callWithRetry(() =>
    fundStore.fundGovernorContract.methods
      .state(proposal.proposalId)
      .call(),
  );
  mappedProposal.state = ProposalStateMapping[proposalState];
  governanceProposalStore.storeProposal(
    governanceProposalStore.web3Store.chainId,
    governanceProposalStore.fundStore.fund?.address,
    mappedProposal,
  );
};
