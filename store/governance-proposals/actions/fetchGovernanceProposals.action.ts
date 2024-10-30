import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";

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

  const processedProposals = fetchedProposals.map((proposal) => {
    governanceProposalStore.storeSubgraphProposal(
      governanceProposalStore.web3Store.chainId,
      governanceProposalStore.fundStore.fund?.address,
      proposal,
    );
    return proposal;
  });

  return processedProposals;
};
