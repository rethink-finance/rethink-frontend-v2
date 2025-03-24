import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";


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
      const web3Store = useWeb3Store();
      const lastNAVUpdateTotalDepositBalance = await getTotalDepositBalanceAtNAVUpdate(web3Store, fund, fundLastNavUpdate);

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

      fund.isSharePriceLoading = true;
      const sharePrice = await getSharePriceAtNavUpdate(web3Store, fundLastNavUpdate, fund);
      fund.sharePrice = sharePrice;
      fund.isSharePriceLoading = false;
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

const getSharePriceAtNavUpdate = async (web3Store: any, navUpdate: INAVUpdate, fund: IFund) => {
  if(navUpdate?.timestamp) {
  // 1. get average block time for the chain
    const web3Instance = web3Store.getWeb3Instance(fund.chainId, false);
    const { initializeBlockTimeContext } = useBlockTime()
    const context = await initializeBlockTimeContext(web3Instance)
    const averageBlockTime = context?.averageBlockTime || 0;

    // 2. get block number for the timestamp
    const totalNav = parseFloat(ethers.formatUnits(navUpdate.totalNAV || 0n, fund?.baseToken.decimals));
    const blockNumber = Number(await getBlockByTimestamp(web3Store, fund.chainId, navUpdate.timestamp / 1000, averageBlockTime) || 0);

    try {
      const totalSupplyRaw = await web3Store.callWithRetry(
        fund.chainId,
        async () => {
          const fundTokenContract = await web3Store.getCustomContract(
            fund.chainId,
            ERC20,
            fund.fundToken.address,
          );

          return fundTokenContract.methods.totalSupply().call({}, blockNumber);
        },
      );

      const totalSupply = parseFloat(ethers.formatUnits(totalSupplyRaw, fund?.fundToken.decimals));
      const sharePrice = totalNav / totalSupply;

      if(fund?.title === "Base DEMO 2"){
        console.log("fund:", fund)
        console.log("raw total supply:", totalSupplyRaw)
        console.log("fundToken decimals:", fund.fundToken.decimals)
        console.log("TOTAL NAV:", totalNav)
        console.log("TOTAL SUPPLY:", totalSupply)
        console.log("SHARE PRICEE:" , sharePrice)
      }

      return sharePrice;
    }
    catch(e){
      console.error("Error getting share price", e)
      return 0;
    }
  }

  return 0;
}
