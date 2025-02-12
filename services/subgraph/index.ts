// services/subgraph/index.ts
import { ApolloClient } from "@apollo/client/core";

import {
  FETCH_DELEGATES,
  FETCH_GOVERNANCE_PROPOSAL,
  FETCH_GOVERNANCE_PROPOSALS,
} from "./queries";

import type ISubgraphFetchDelegatesResponse from "~/types/responses/subgraph_fetch_delegates";
import type ISubgraphGovernanceProposal from "~/types/subgraph_governance_proposal";
import { type ChainId } from "~/store/web3/networksMap";

export interface GovernorProposalsResponse {
  proposals: ISubgraphGovernanceProposal[];
}

export const fetchSubgraphGovernorProposals = async (
  chainId: ChainId,
  values: {
    governorAddress: string;
  },
): Promise<ISubgraphGovernanceProposal[]> => {
  const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;

  if (!client) {
    throw new Error("Apollo client not found");
  }

  try {
    const { data } = await client.query<GovernorProposalsResponse>({
      query: FETCH_GOVERNANCE_PROPOSALS,
      variables: { governorAddress: values.governorAddress },
      fetchPolicy: "network-only", // Adjust based on caching needs
    });
    console.log("fetched data of proposals", data);
    if (!data || !data.proposals) {
      throw new Error("Received no data or events!");
    }

    return data.proposals;
  } catch (error) {
    console.error("Error fetching governor proposals:", error);
    throw error;
  }
};

export interface GovernorProposalResponse {
  proposals: ISubgraphGovernanceProposal[];
}

export const fetchSubgraphGovernorProposal = async (
  chainId: ChainId,
  values: {
    governorAddress: string;
    proposalId: string;
  },
): Promise<ISubgraphGovernanceProposal> => {
  const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;

  if (!client) {
    throw new Error("Apollo client not found");
  }

  try {
    const { data } = await client.query<GovernorProposalResponse>({
      query: FETCH_GOVERNANCE_PROPOSAL,
      variables: {
        governorAddress: values.governorAddress,
        proposalId: values.proposalId,
      },
      fetchPolicy: "network-only", // Adjust based on caching needs
    });

    if (!data || !data.proposals) {
      throw new Error("Received no data or events!");
    }

    return data.proposals[0];
  } catch (error) {
    console.error("Error fetching governor proposal:", error);
    throw error;
  }
};

export interface DelegateResponse {
  votingContract: ISubgraphFetchDelegatesResponse;
}

export const fetchSubgraphDelegates = async (
  chainId: ChainId,
  values: {
    votingContract: string;
  },
): Promise<ISubgraphFetchDelegatesResponse> => {
  const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;

  if (!client) {
    throw new Error("Apollo client not found");
  }
  try {
    const { data } = await client.query<DelegateResponse>({
      query: FETCH_DELEGATES,
      variables: { votingContract: values.votingContract },
    });
    console.log("fetchSubgraphDelegates data: ", data);
    if (!data || !data.votingContract) {
      throw new Error("Received no data or events!");
    }

    return data.votingContract;
  } catch (error) {
    console.error("Error fetching subgraph delegates response:", error);
    throw error;
  }
};
