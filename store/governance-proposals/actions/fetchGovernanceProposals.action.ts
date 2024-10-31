import type { ApolloClient } from "@apollo/client";
import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ClockMode } from "~/types/enums/clock_mode";
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

  const roleModAddress = await fundStore.getRoleModAddress(); // TODO replace with fetchGovernableFund

  const quorumDenominator = await governanceProposalStore.callWithRetry(() =>
    fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  ); // TODO

  const fetchedProposals = await fetchSubgraphGovernorProposals(client.value, {
    governorAddress: fundStore.fund?.governorAddress,
  });

  const proposalsWithPoints = fetchedProposals.map((proposal) => ({
    proposal,
    timepoint:
      fundStore.fund?.clockMode?.mode === ClockMode.BlockNumber
        ? proposal.proposalCreated?.[0]?.transaction?.blockNumber
        : proposal.proposalCreated?.[0]?.timestamp,
    blockNumber: proposal.proposalCreated?.[0]?.transaction?.blockNumber,
  }));

  const uniquePoints = [
    ...new Set(
      proposalsWithPoints.map((p) =>
        JSON.stringify({
          timepoint: p.timepoint,
          blockNumber: p.blockNumber,
        }),
      ),
    ),
  ].map((str) => JSON.parse(str));

  const pointsDataMap = Object.fromEntries(
    await Promise.all(
      uniquePoints.map(async ({ timepoint, blockNumber }) => {
        const [quorumNumerator, totalSupply] = await Promise.all([
          fundStore.fundGovernorContract.methods
            .quorumNumerator(timepoint)
            .call(), // TODO
          fundStore.fundGovernorContract.methods
            .totalSupply()
            .call({ blockNumber }), // TODO
        ]);
        return [
          JSON.stringify({ timepoint, blockNumber }),
          { quorumNumerator, totalSupply },
        ];
      }),
    ),
  );

  const processedProposals = proposalsWithPoints.map(({ proposal, timepoint, blockNumber }) => {
    const key = JSON.stringify({ timepoint, blockNumber });
    const { quorumNumerator, totalSupply } = pointsDataMap[key];

    return _mapSubgraphProposalToProposal(
      proposal,
      governanceProposalStore.decodeProposalCallData.bind(
        governanceProposalStore,
      ),
      totalSupply,
      fundStore.fund?.governanceToken?.decimals || 18,
      quorumNumerator,
      quorumDenominator,
      roleModAddress,
      fundStore.fund?.safeAddress,
    );
  });

  governanceProposalStore.storeProposals(
    governanceProposalStore.web3Store.chainId,
    governanceProposalStore.fundStore.fund?.address,
    processedProposals,
  );

  return processedProposals;
};
