import { useGovernanceProposalsStore } from "../governance_proposals.store";

import { fetchSubgraphGovernorProposal } from "~/services/subgraph";
import { useFundStore } from "~/store/fund/fund.store";
import { ClockMode } from "~/types/enums/clock_mode";
import { _mapSubgraphProposalToProposal } from "~/types/helpers/mappers";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchGovernanceProposalAction = async (
  proposalId: string,
): Promise<any> => {
  const governanceProposalStore = useGovernanceProposalsStore();
  const web3Store = useWeb3Store();
  const fundStore = useFundStore();
  const fund = unref(fundStore.fund);
  if (!fund) {
    return;
  }
  if (!fund?.governorAddress)
    throw new Error("Governor address not found");
  if (!proposalId) throw new Error("Proposal ID not found");

  const proposal = await fetchSubgraphGovernorProposal(
    fund?.chainId,
    {
      governorAddress: fund?.governorAddress,
      proposalId,
    });
  const { initializeBlockTimeContext, getTimestampForBlock } = useBlockTime();
  const blockTimeContext = await initializeBlockTimeContext(
    governanceProposalStore.getWeb3InstanceByChainId(),
  );

  const roleModAddress = await fundStore.getRoleModAddress();
  const quorumDenominator = await web3Store.callWithRetry(
    fund?.chainId,
    () =>
      fundStore.fundGovernorContract.methods.quorumDenominator().call(),
  );

  const timepoint =
    fund?.clockMode?.mode === ClockMode.BlockNumber
      ? proposal.proposalCreated?.[0]?.transaction?.blockNumber
      : proposal.proposalCreated?.[0]?.timestamp;
  const blockNumber = proposal.proposalCreated?.[0]?.transaction?.blockNumber;

  const [quorumNumerator, totalSupply] = await Promise.all([
    web3Store.callWithRetry(
      fund?.chainId,
      () =>
        fundStore.fundGovernorContract.methods.quorumNumerator(timepoint).call(),
    ),
    web3Store.callWithRetry(
      fund?.chainId,
      () =>
        fundStore.fundGovernanceTokenContract.methods
          .totalSupply()
          .call({ blockNumber }),
    ),
  ]);

  const mappedProposal = await _mapSubgraphProposalToProposal(
    proposal,
    totalSupply,
    blockTimeContext,
    fund?.governanceToken.decimals ?? 0,
    quorumNumerator,
    quorumDenominator,
    getTimestampForBlock,
    fund?.clockMode?.mode as ClockMode,
    roleModAddress ?? "",
    fund?.safeAddress ?? "",
    fund?.address ?? "",
  );

  governanceProposalStore.storeProposal(
    fund?.chainId,
    fund?.address,
    mappedProposal,
  );

  return mappedProposal;
};
