import type { ApolloClient } from "@apollo/client";

import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphDelegates } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { _mapSubgraphFetchDelegatesToDelegates } from "~/types/helpers/mappers";

export const fetchDelegatesAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const governanceProposalStore = useGovernanceProposalsStore();
  const nuxtApp = useNuxtApp();
  const client = nuxtApp.$apolloClient as Ref<ApolloClient<any>>;

  if (!client) {
    throw new Error("Apollo client not found");
  }
  const fund = unref(fundStore.fund);
  const votingContractAddress = fund?.governanceToken?.address;

  if (!votingContractAddress) {
    throw new Error("Governor token address not found");
  }

  const fetchedDelegates = await fetchSubgraphDelegates(client.value, {
    votingContract: votingContractAddress,
  });
  const processedDelegates = _mapSubgraphFetchDelegatesToDelegates(
    fetchedDelegates,
    fund?.governanceToken?.decimals || 18,
  );
  governanceProposalStore.storeDelegates(
    fund?.chainId,
    fund?.address,
    processedDelegates,
  );
  console.log("processedDelegates: ", processedDelegates);
  return fetchedDelegates;
};
