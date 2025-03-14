import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { ChainId, type ChainId as ChainIdType } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFund from "~/types/fund";


export const calculateFundPerformanceMetricsAction = async (
  fund: IFund | undefined,
): Promise<any> => {
  if (!fund) {
    console.error("Error: this.fund is not available");
    return;
  }

  try {
    const fundNAVUpdates = fund.navUpdates;
    const fundLastNavUpdate = fundNAVUpdates[fundNAVUpdates?.length - 1];
    const fundLastNavUpdateExists = fundLastNavUpdate?.timestamp;
    console.debug("  [METRICS] title", fund.title)
    console.debug("  [METRICS] totalDepositBalance", fund.totalDepositBalance)
    console.debug("  [METRICS] fund.lastNAVUpdateTotalNAV", fund.lastNAVUpdateTotalNAV)
    console.debug("  [METRICS] last NAV update", fundLastNavUpdate)

    if (fund) {
      const lastNAVUpdateTotalDepositBalance = await getFundLastNAVUpdateTotalDepositBalance(fund, fundLastNavUpdate);

      const baseTokenDecimals = fund.baseToken.decimals;
      const cumulativeReturnPercent = fundLastNavUpdateExists
        ? calculateCumulativeReturnPercent(
          lastNAVUpdateTotalDepositBalance || 0n,
          fund.lastNAVUpdateTotalNAV || 0n,
          baseTokenDecimals,
        )
        : 0;

      fund.lastNAVUpdateTotalNAV = fundLastNavUpdateExists
        ? fund.lastNAVUpdateTotalNAV
        : fund.totalDepositBalance;
      fund.cumulativeReturnPercent = cumulativeReturnPercent;
      fund.isNavUpdatesLoading = false;
      fund.sharpeRatio = calculateSharpeRatio(fundNAVUpdates, fund.totalDepositBalance);
    }
  } catch (error) {
    console.error(
      "Error calculating fund performance metrics: ",
      fund,
      error,
    );
    fund.isNavUpdatesLoading = false;
  }
}

const getFundLastNAVUpdateTotalDepositBalance = async (fund: IFund, fundLastNavUpdate: any) => {
  if(fundLastNavUpdate?.timestamp) {
    const web3Store = useWeb3Store();
    // 1. get average block time for the chain
    const web3Instance = web3Store.getWeb3Instance(fund.chainId, false);
    const { initializeBlockTimeContext } = useBlockTime()
    const context = await initializeBlockTimeContext(web3Instance)
    const averageBlockTime = context?.averageBlockTime || 0;

    // 2. estimate the block number of the last NAV update timestamp
    const lastNavUpdateBlockNumber = Number(await getBlockByTimestamp(web3Store, fund.chainId, fundLastNavUpdate.timestamp / 1000, averageBlockTime) || 0);

    // 3. get total deposit balance at the last NAV update
    try {
      const totalDepositBal = await web3Store.callWithRetry(
        fund.chainId,
        async () => {
          const fundContract = web3Store.getCustomContract(
            fund.chainId,
            GovernableFund.abi,
            fund.address,
          );

          return BigInt(await fundContract.methods._totalDepositBal().call({}, lastNavUpdateBlockNumber) || 0)
        },
      );

      return totalDepositBal;
    } catch (e) {
      console.error("Error getting total deposit balance at last NAV update", e);
      return null;
    }
  }

  return null;
}

// TODO: we don't use this f-ijon, but might be useful in the future? should we keep it?
const getL1BlockNumber = async (l2BlockNumber: number, chainId: ChainIdType) => {
  try {
    const web3Store = useWeb3Store();
    const provider = web3Store.chainProviders[chainId];

    // Fetch the L2 block details
    const l2Block = await web3Store.callWithRetry(
      chainId,
      async () => await provider.eth.getBlock(l2BlockNumber),
    );

    if (!l2Block) {
      console.error(`Block not found on L2: ${l2BlockNumber}`);
      return null;
    }

    console.warn("L1 block number not found in L2 metadata. Estimating...");

    // Fetch the latest Ethereum L1 block
    const ethProvider = web3Store.getWeb3Instance(ChainId.ETHEREUM);
    const latestL1Block = await web3Store.callWithRetry(
      ChainId.ETHEREUM,
      async () => await ethProvider.eth.getBlock("latest"),
    );

    if (!latestL1Block) {
      console.error("Failed to fetch latest L1 block.");
      return null;
    }

    // Get block times for better estimation
    const { initializeBlockTimeContext } = useBlockTime();
    const context = await initializeBlockTimeContext(ethProvider);
    const averageL1BlockTime = context?.averageBlockTime || 12; // Default fallback to 12s

    // Estimate based on time difference
    const l2Timestamp = Number(l2Block.timestamp);
    const l1LatestTimestamp = Number(latestL1Block.timestamp);

    const estimatedL1Block =
      Number(latestL1Block.number) -
      Math.floor((l1LatestTimestamp - l2Timestamp) / averageL1BlockTime);

    console.debug("Estimated L1 Block:", estimatedL1Block);

    return estimatedL1Block;
  } catch (e) {
    console.error("Error getting L1 block number", e);
    return null;
  }
};
