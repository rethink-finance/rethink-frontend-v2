import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { IFundInitCache } from "~/types/fund_settings";
import { RethinkFundGovernor } from "assets/contracts/RethinkFundGovernor";
import { formatQuorumPercentage } from "~/composables/formatters";
import { ERC20 } from "assets/contracts/ERC20";
import { GovernableFund } from "assets/contracts/GovernableFund";


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
const fetchBaseTokenDetails = async (chainId: string, baseTokenAddress: string) => {
  const web3Store = useWeb3Store();

  const tokenContract = web3Store.getCustomContract(
    chainId,
    ERC20,
    baseTokenAddress,
  );

  const baseDecimals = await web3Store.callWithRetry(
    chainId,
    () =>
      tokenContract.methods.decimals().call(),
  );
  const baseSymbol = await web3Store.callWithRetry(
    chainId,
    () =>
      tokenContract.methods.symbol().call(),
  );

  return [Number(baseDecimals), baseSymbol];
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

  const fundInitCache: IFundInitCache = await web3Store.callWithRetry(
    fundChainId,
    () =>
      fundFactoryContract.methods.getFundInitializationCache(
        deployerAddress,
      ).call(),
  ) || {};
  const fundContract = web3Store.getCustomContract(
    fundChainId,
    GovernableFund.abi,
    fundInitCache.fundContractAddr,
  );

  console.log("GET fund settings")
  const sett = await web3Store.callWithRetry(
    fundChainId,
    () =>
      fundContract.methods.getFundSettings().call(),
  );
  console.log("fund settings2:", sett)

  // Parse Metadata JSON string
  fundInitCache.governorData = await fetchGovernorData(fundChainId, fundInitCache?.fundSettings?.governor);
  fundInitCache.fundMetadata = JSON.parse(fundInitCache._fundMetadata || "{}");
  fundInitCache.fundMetadata.chainId = fundChainId;

  // Add more fields to fund metadata.
  const fundSettings = fundInitCache?.fundSettings || {};
  const feeCollectors = fundSettings?.feeCollectors || [];
  const whitelistedAddresses = fundInitCache.fundSettings?.allowedDepositAddrs?.join("\n") || [];

  // Fetch fund base token decimals
  const [baseDecimals, baseSymbol] = await fetchBaseTokenDetails(
    fundChainId,
    fundInitCache.fundSettings.baseToken,
  );
  console.warn("BASE DECIMALS & SYMBOL", baseDecimals, baseSymbol)

  fundInitCache.fundSettings = {
    ...fundInitCache.fundSettings,
    chainId: fundChainId,
    whitelist: whitelistedAddresses,
    // Add fee collector addresses as key value pairs to fundSettings
    depositFee: (fundSettings?.depositFee || 0).toString(),
    depositFeeRecipientAddress: feeCollectors[0] || "",
    withdrawFee: (fundSettings?.withdrawFee || 0).toString(),
    withdrawFeeRecipientAddress: feeCollectors[1] || "",
    managementFee: (fundSettings?.managementFee || 0).toString(),
    managementFeeRecipientAddress: feeCollectors[2] || "",
    managementFeePeriod: Number(fundInitCache._feeManagePeriod || 0),
    performanceFee: (fundSettings?.performanceFee || 0).toString(),
    performanceFeePeriod: Number(fundInitCache._feePerformancePeriod || 0),
    performanceFeeRecipientAddress: feeCollectors[3] || "",
    baseDecimals,
    baseSymbol,
  };


  createFundStore.fundInitCache = fundInitCache;
  console.log("fund init cache", createFundStore.fundInitCache);
  return fundInitCache;
};
