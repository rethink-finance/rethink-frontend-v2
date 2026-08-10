// services/subgraph/index.ts
import { ApolloClient } from "@apollo/client/core";

import {
  FETCH_DELEGATES,
  FETCH_GOVERNANCE_PROPOSAL,
  FETCH_GOVERNANCE_PROPOSALS,
  FETCH_FUND_FLOWS,
  FETCH_FUND_FLOWS_BY_NAMES,
  FETCH_USER_FLOWS,
} from "./queries";

import { type ChainId } from "~/types/enums/chain_id";
import type ISubgraphFetchDelegatesResponse from "~/types/responses/subgraph_fetch_delegates";
import type ISubgraphGovernanceProposal from "~/types/subgraph_governance_proposal";

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

// Fund Flows
export interface FundFlow {
  id: string;
  timestamp: string;
  blockNumber: string;
  txFrom: { id: string } | null;
  transaction: { id: string };
  caller: { id: string };
  raw: string;
  selector: string;
  selectorHex: string;
  name: string;
  amount: string | null;
  amount2?: string | null;
  feeKind?: string | null;
  flag?: boolean | null;
  account: { id: string } | null;
  fund: {
    id: string;
    fundName?: string | null;
    fundContractAddr?: string | null;
    govContractAddr?: string | null;
  };
}

export interface FundFlowsResponse {
  fundFlows: FundFlow[];
  fundFlowsConnection?: { totalCount: number };
}

export const fetchSubgraphFundFlows = async (
  chainId: ChainId,
  values: { fundAddress: string; first: number; skip: number; names?: string[] },
): Promise<{ items: FundFlow[]; totalCount: number }> => {
  const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;

  if (!client) {
    throw new Error("Apollo client not found");
  }

  try {
    const { data } = await client.query<FundFlowsResponse>({
      // The filtered query only exists because The Graph cannot express an
      // optional name_in — see FETCH_FUND_FLOWS_BY_NAMES.
      query: values.names?.length ? FETCH_FUND_FLOWS_BY_NAMES : FETCH_FUND_FLOWS,
      variables: {
        fundAddress: values.fundAddress.toLowerCase(),
        first: values.first,
        skip: values.skip,
        ...(values.names?.length ? { names: values.names } : {}),
      },
      fetchPolicy: "network-only",
    });
    console.log("fetchSubgraphFundFlows data: ", data);
    if (!data || !data.fundFlows) {
      throw new Error("Received no data or events!");
    }

    const totalCount =
      (data as any)?.fundFlowsConnection?.totalCount ?? data.fundFlows.length;

    return { items: data.fundFlows, totalCount };
  } catch (error) {
    console.error("Error fetching fund flows:", error);
    throw error;
  }
};

/**
 * Flows signed by one wallet on a chain, newest first. Feeds the portfolio's
 * activity card; callers query each chain's subgraph separately and merge,
 * since every chain runs its own deployment.
 */
export const fetchSubgraphUserFlows = async (
  chainId: ChainId,
  values: { userAddress: string; first: number; skip?: number },
): Promise<FundFlow[]> => {
  const client = useNuxtApp().$getApolloClient(chainId) as ApolloClient<any>;

  if (!client) {
    throw new Error("Apollo client not found");
  }

  const { data } = await client.query<FundFlowsResponse>({
    query: FETCH_USER_FLOWS,
    variables: {
      userAddress: values.userAddress.toLowerCase(),
      first: values.first,
      skip: values.skip ?? 0,
    },
    fetchPolicy: "network-only",
  });

  return data?.fundFlows ?? [];
};

/** The Graph refuses a page larger than this. */
const SUBGRAPH_MAX_PAGE = 1000;

/**
 * Every flow a wallet has signed on a chain, followed through to the end.
 *
 * The portfolio measures return against what was actually paid in, so it needs
 * the whole history rather than a recent window — a wallet's first deposit is
 * the one figure it cannot do without. Pages are followed until one comes back
 * short, with a ceiling so a runaway response cannot loop forever.
 */
export const fetchAllSubgraphUserFlows = async (
  chainId: ChainId,
  userAddress: string,
  maxPages = 10,
): Promise<FundFlow[]> => {
  const flows: FundFlow[] = [];

  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchSubgraphUserFlows(chainId, {
      userAddress,
      first: SUBGRAPH_MAX_PAGE,
      skip: page * SUBGRAPH_MAX_PAGE,
    });
    flows.push(...batch);
    if (batch.length < SUBGRAPH_MAX_PAGE) break;
  }

  return flows;
};
