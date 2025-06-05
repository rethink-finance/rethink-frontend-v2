import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphDelegates } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { _mapSubgraphFetchDelegatesToDelegates } from "~/types/helpers/mappers";

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

  const fetchedDelegates = await fetchSubgraphDelegates(
    fund.chainId,
    {
      votingContract: votingContractAddress,
    },
  );
  if (!fetchedDelegates) return;

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
