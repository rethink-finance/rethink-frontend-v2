import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { IFundInitCache } from "~/types/fund_settings";
import { RethinkFundGovernor } from "assets/contracts/RethinkFundGovernor";
import { ClockMode } from "~/types/enums/clock_mode";
import { formatQuorumPercentage } from "~/composables/formatters";


const fetchGovernorData = async (fundChainId: string, governorAddress?: string) => {
  /*
    Data to fetch:
    "quorum"
    "votingPeriod"
    "votingDelay"
    "proposalThreshold"
    "lateQuorum"
   */
  if (!governorAddress) return {};

  const web3Store = useWeb3Store();

  const fundGovernorContract = web3Store.getCustomContract(
    fundChainId,
    RethinkFundGovernor.abi,
    governorAddress,
  )
  const [
    quorumNumerator,
    quorumDenominator,
    votingDelay,
    votingPeriod,
    proposalThreshold,
    lateQuorum,
  ] = await Promise.all([
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.quorumNumerator().call(),
    ),
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.quorumDenominator().call(),
    ),
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.votingDelay().call(),
    ),
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.votingPeriod().call(),
    ),
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.proposalThreshold().call(),
    ),
    web3Store.callWithRetry(
      fundChainId,
      () =>
        fundGovernorContract.methods.lateQuorumVoteExtension().call(),
    ),
  ]);

  return {
    quorumNumerator: Number(quorumNumerator),
    quorumDenominator: Number(quorumDenominator),
    quorum: formatQuorumPercentage(quorumNumerator, quorumDenominator),
    votingDelay: Number(votingDelay),
    votingPeriod: Number(votingPeriod),
    proposalThreshold: Number(proposalThreshold),
    lateQuorum: Number(lateQuorum),
  };
}

export const fetchFundCacheAction = async (
  fundChainId: string,
  deployerAddress: string,
): Promise<IFundInitCache> => {
  const createFundStore = useCreateFundStore();
  const web3Store = useWeb3Store();

  if (!fundChainId) {
    throw new Error("No fund chainId provided, cannot fetch fund cache.");
  }
  if (!deployerAddress) {
    throw new Error("No deployerAddress provided, cannot fetch fund cache.");
  }
  const fundFactoryContract = web3Store.chainContracts[fundChainId]?.fundFactoryContract;

  const fundInitCache = await web3Store.callWithRetry(
    fundChainId,
    () =>
      fundFactoryContract.methods.getFundInitializationCache(
        deployerAddress,
      ).call(),
  ) || {};


  // Parse Metadata JSON string
  fundInitCache.governorData = await fetchGovernorData(fundChainId, fundInitCache?.fundSettings?.governor);
  fundInitCache.fundMetadata = JSON.parse(fundInitCache._fundMetadata || "{}");
  fundInitCache.fundMetadata.chainId = fundChainId;

  // Add more fields to fund metadata.
  const fundSettings = fundInitCache?.fundSettings || {};
  const feeCollectors = fundSettings?.feeCollectors || [];
  const whitelistedAddresses = fundInitCache.fundSettings?.allowedDepositAddrs?.join("\n") || [];

  fundInitCache.fundSettings = {
    ...fundInitCache.fundSettings,
    chainId: fundChainId,
    whitelist: whitelistedAddresses,
    // Add fee collector addresses as key value pairs to fundSettings
    depositFee: Number(fundSettings?.depositFee || 0),
    depositFeeRecipientAddress: feeCollectors[0] || "",
    withdrawFee: Number(fundSettings?.withdrawFee || 0),
    withdrawFeeRecipientAddress: feeCollectors[1] || "",
    managementFee: Number(fundSettings?.managementFee || 0),
    managementFeeRecipientAddress: feeCollectors[2] || "",
    managementFeePeriod: Number(fundInitCache._feeManagePeriod || 0),
    performanceFee: Number(fundSettings?.performanceFee || 0),
    performanceFeePeriod: Number(fundInitCache._feePerformancePeriod || 0),
    performanceFeeRecipientAddress: feeCollectors[3] || "",
  };


  createFundStore.fundInitCache = fundInitCache;
  console.log("fund init cache", createFundStore.fundInitCache);
  return fundInitCache;
};
