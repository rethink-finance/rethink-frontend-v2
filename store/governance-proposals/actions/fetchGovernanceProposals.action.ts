import { useGovernanceProposalsStore } from "../governance_proposals.store";
import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ClockMode } from "~/types/enums/clock_mode";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchGovernanceProposalsAction = async (): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  const fund = fundStore.fund;
  if (!fund) {
    return;
  }
  if (!fund?.governorAddress) {
    throw new Error("Governor address not found");
  }

  const { initializeBlockTimeContext, getTimestampForBlock } = useBlockTime();
  const blockTimeContext = await initializeBlockTimeContext(
    governanceProposalStore.getWeb3InstanceByChainId(),
  );

  const roleModAddress = await fundStore.getRoleModAddress(); // TODO replace with fetchGovernableFund

  const quorumDenominator = await web3Store.callWithRetry(
    fund.chainId,
    () =>
      fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  );

  const fetchedProposals = await fetchSubgraphGovernorProposals(
    fund.chainId,
    {
      governorAddress: fund?.governorAddress,
    },
  );

  const proposalsWithPoints = fetchedProposals.map((proposal) => ({
    proposal,
    timepoint:
      fund?.clockMode?.mode === ClockMode.BlockNumber
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
          web3Store.callWithRetry(
            fund.chainId,
            () =>
              fundStore.fundGovernorContract.methods
                .quorumNumerator(timepoint)
                .call(), // TODO
          ),
          web3Store.callWithRetry(
            fund.chainId,
            () =>
              fundStore.fundGovernanceTokenContract.methods
                .totalSupply()
                .call({ blockNumber }), // TODO
          ),
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
      totalSupply,
      blockTimeContext,
      fund?.governanceToken?.decimals || 18,
      quorumNumerator,
      quorumDenominator,
      getTimestampForBlock,
      fund?.clockMode?.mode as ClockMode,
      roleModAddress ?? "",
      fund?.safeAddress ?? "",
      fund?.address ?? "",
    );
  });

  const mappedProposals = await Promise.all(processedProposals);

  governanceProposalStore.storeProposals(
    fund.chainId,
    fund?.address,
    mappedProposals,
  );

  return mappedProposals;
};
