// services/subgraph/index.ts
import { ApolloClient } from "@apollo/client/core";

import { FETCH_GOVERNANCE_PROPOSALS } from "./queries";

import type ISubgraphGovernanceProposal from "~/types/subgraph_governance_proposal";


export interface GovernorProposalsResponse {
  proposals: ISubgraphGovernanceProposal[];
}

export const fetchSubgraphGovernorProposals = async (
  client: ApolloClient<any>, // No need for NormalizedCacheObject
  values: {
    governorAddress: string;
  },
): Promise<ISubgraphGovernanceProposal[]> => {
  try {
    const { data } = await client.query<GovernorProposalsResponse>({
      query: FETCH_GOVERNANCE_PROPOSALS,
      variables: { governorAddress: values.governorAddress },
      fetchPolicy: "network-only", // Adjust based on caching needs
    });

    if (!data || !data.proposals) {
      throw new Error("Received no data or events!");
    }

    return data.proposals;
  } catch (error) {
    console.error("Error fetching governor proposals:", error);
    throw error;
  }
};
