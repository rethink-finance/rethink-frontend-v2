import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ProposalStateMapping } from "~/types/enums/governance_proposal";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";

export const fetchGovernanceProposalsAction = async (): Promise<any> => {
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

  const fetchedProposals = await fetchSubgraphGovernorProposals(client.value, {
    governorAddress: fundStore.fund?.governorAddress, // Replace with actual address
  });
  console.log("fetchSubgraphGovernorProposals:raw", fetchedProposals);
  const roleModAddress = await fundStore.getRoleModAddress();
  const processedProposals = fetchedProposals.map(async (proposal) => {
    const mappedProposal = _mapSubgraphProposalToProposal(
      proposal,
      governanceProposalStore.decodeProposalCallData.bind(
        governanceProposalStore,
      ),
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
    return mappedProposal;
  });
  console.log("fetchSubgraphGovernorProposals:mapped", processedProposals);
  return processedProposals;
};
