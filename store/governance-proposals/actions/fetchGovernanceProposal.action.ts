import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposal } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ClockMode } from "~/types/enums/clock_mode";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";

export const fetchGovernanceProposalAction = async (
  proposalId: string,
): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const fundStore = useFundStore();
  const nuxtApp = useNuxtApp();
  const client = nuxtApp.$apolloClient as Ref<ApolloClient<any>>;

  if (!client) throw new Error("Apollo client not found");
  if (!fundStore.fund?.governorAddress)
    throw new Error("Governor address not found");
  if (!proposalId) throw new Error("Proposal ID not found");

  const proposal = await fetchSubgraphGovernorProposal(client.value, {
    governorAddress: fundStore.fund?.governorAddress,
    proposalId,
  });

  const roleModAddress = await fundStore.getRoleModAddress();
  const quorumDenominator = await governanceProposalStore.callWithRetry(() =>
    fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  );

  const timepoint =
    fundStore.fund?.clockMode?.mode === ClockMode.BlockNumber
      ? proposal.proposalCreated?.[0]?.transaction?.blockNumber
      : proposal.proposalCreated?.[0]?.timestamp;
  const blockNumber = proposal.proposalCreated?.[0]?.transaction?.blockNumber;

  const [quorumNumerator, totalSupply] = await Promise.all([
    governanceProposalStore.callWithRetry(() =>
      fundStore.fundGovernorContract.methods.quorumNumerator(timepoint).call(),
    ),
    governanceProposalStore.callWithRetry(() =>
      fundStore.fundGovernorContract.methods
        .totalSupply()
        .call({ blockNumber }),
    ),
  ]);

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

  governanceProposalStore.storeProposals(
    governanceProposalStore.web3Store.chainId,
    governanceProposalStore.fundStore.fund?.address,
    [mappedProposal],
  );

  return mappedProposal;
};
