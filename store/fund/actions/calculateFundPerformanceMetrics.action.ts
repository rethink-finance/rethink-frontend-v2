import { GovernableFund } from "~/assets/contracts/GovernableFund";
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
