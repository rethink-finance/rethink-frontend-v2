import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { calculateCumulativeWithSharePrice } from "~/composables/utils";
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
      // const lastNAVUpdateTotalDepositBalance = await getTotalDepositBalanceAtNAVUpdate(web3Store, fund, fundLastNavUpdate);

      const sharePrice = await getSharePriceAtNavUpdate(web3Store, fundLastNavUpdate, fund)
      fund.sharePrice = sharePrice;

      const baseTokenDecimals = fund.baseToken.decimals;
      const fundTokenDecimals = fund.fundToken.decimals;
      const cumulativeReturnPercent = calculateCumulativeWithSharePrice(
        sharePrice,
        baseTokenDecimals,
        fundTokenDecimals,
      )

      fund.lastNAVUpdateTotalNAV = fundLastNavUpdateExists
        ? fund.lastNAVUpdateTotalNAV
        : fund.totalDepositBalance;
      fund.cumulativeReturnPercent = cumulativeReturnPercent;
      fund.isNavUpdatesLoading = false;
      fund.sharpeRatio = calculateSharpeRatio(fundNAVUpdates, fund.totalDepositBalance);

      fund.isSharePriceLoading = true;
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
    const totalNav = navUpdate.totalNAV ?? 0n;
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

      const totalSupply = totalSupplyRaw ?? 0n;

      // Determine the highest decimals between NAV and Supply
      const navDecimals = fund.baseToken.decimals;
      const supplyDecimals = fund.fundToken.decimals;
      const diffDecimals = navDecimals - supplyDecimals;

      // Scale totalNav to the same decimals as totalSupply for proper division
      const adjustedTotalNav = diffDecimals > 0 ? totalNav * 10n ** BigInt(diffDecimals) : totalNav;
      const adjustedTotalSupply = diffDecimals < 0 ? totalSupply * 10n ** BigInt(-diffDecimals) : totalSupply;

      // Perform the division
      const sharePriceBigInt = totalSupply > 0n ? (adjustedTotalNav * 10n ** 18n) / adjustedTotalSupply : 0n;

      // Convert to float and format the share price correctly
      const sharePrice = parseFloat(ethers.formatUnits(sharePriceBigInt, 18));

      return sharePrice;
    }
    catch(e){
      console.error("Error getting share price", e)
      return undefined;
    }
  }

  return 0;
}
