import { GovernableFund } from "~/assets/contracts/GovernableFund";
import type { ChainId as ChainIdType } from "~/store/web3/networksMap";
import { ChainId } from "~/store/web3/networksMap";
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
    const chainProvider = web3Store.chainProviders[fund.chainId]
    // 1. get average block time for the chain
    const { initializeBlockTimeContext } = useBlockTime()
    const context = await initializeBlockTimeContext(chainProvider)
    const averageBlockTime = context?.averageBlockTime || 0;

    // 2. estimate the block number of the last NAV update timestamp
    const lastNavUpdateBlockNumber = Number(await getBlockByTimestamp(fund.chainId, fundLastNavUpdate.timestamp / 1000, averageBlockTime) || 0);

    // 3. get total deposit balance at the last NAV update
    const fundContract = web3Store.getCustomContract(
      fund.chainId,
      GovernableFund.abi,
      fund.address,
    );

    // TODO: figure out why arbitrum chainId is not working with _totalDepositBal
    // try to use different approach as a fallback if _totalDepositBal is not working
    if(fund.chainId === ChainId.ARBITRUM) {
      // const totalDepositBal = BigInt(await fundContract.methods._totalDepositBal().call() || 0);
      return null;
    }

    const totalDepositBal = BigInt(await fundContract.methods._totalDepositBal().call({}, lastNavUpdateBlockNumber) || 0);
    return totalDepositBal;
  }

  return null;
}


// TODO: we might move this f-ijon to utils or somewhere else
const getBlockByTimestamp = async (chainId: ChainIdType, timestamp: number, averageBlockTime: number) =>{
  try {
    const web3Store = useWeb3Store();
    const provider = web3Store.chainProviders[chainId]

    const latestBlock = await web3Store
      .callWithRetry(
        chainId,
        async () =>
          Number(await provider.eth.getBlockNumber()),
      )
    const latestBlockData = await web3Store
      .callWithRetry(
        chainId,
        async () =>
          await provider.eth.getBlock(latestBlock),
      )
    const latestTimestamp = Number(latestBlockData.timestamp);

    let estimatedStartBlock = latestBlock - Math.floor((latestTimestamp - timestamp) / averageBlockTime);

    console.log("latestBlock: ", latestBlock);
    console.log("estimatedStartBlock: ", estimatedStartBlock);

    estimatedStartBlock = Math.max(estimatedStartBlock, 0);
    let low = estimatedStartBlock;
    let high = latestBlock;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block =  await web3Store
        .callWithRetry(
          chainId,
          async () =>
            await provider.eth.getBlock(mid, false),
        )

      if (!block) break;

      if (Number(block.timestamp) < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }

      console.log("low: ", low);
      console.log("high: ", high);
    }

    const lowBlock =  await web3Store
      .callWithRetry(
        chainId,
        async () =>
          await provider.eth.getBlock(low),
      )
    const highBlock = low > 0 ?  await web3Store
      .callWithRetry(
        chainId,
        async () =>
          await provider.eth.getBlock(low - 1),
      ) : null

    if (
      highBlock &&
      Math.abs(Number(highBlock.timestamp) - timestamp) < Math.abs(Number(lowBlock.timestamp) - timestamp)
    ) {
      return highBlock.number;
    }

    return lowBlock.number;
  } catch (e) {
    console.error("Error getting block by timestamp", e);
    return null;
  }
}
