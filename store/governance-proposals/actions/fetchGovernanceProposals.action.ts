import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposals } from "~/services/subgraph";

export const fetchGovernanceProposalsAction = async (): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const nuxtApp = useNuxtApp();
  const client = nuxtApp.$apolloClient as Ref<ApolloClient<any>>;

  if (!client) {
    throw new Error("Apollo client not found");
  }

  const fetchedProposals = await fetchSubgraphGovernorProposals(client.value, {
    governorAddress: "0x", // Replace with actual address
  });

  const processedProposals = fetchedProposals.map((proposal) => {
    governanceProposalStore.storeProposal(
      governanceProposalStore.web3Store.chainId,
      governanceProposalStore.fundStore.fund?.address,
      proposal,
    );
    return proposal;
  });

  return processedProposals;
};
