import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { calculateCumulativeWithSharePrice } from "~/composables/utils";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";


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
      const isQCLGFund = fund.address.toLowerCase() === "0xABC961AFc18dfE9F062cf9a8046346E92a934D08".toLowerCase();

      if (isQCLGFund){
        const sharePrice = await getSharePriceAtNavUpdate(fundLastNavUpdate, fund)
        fund.sharePrice = sharePrice;

        fund.cumulativeReturnPercent = calculateCumulativeWithSharePrice(
          undefined,
          sharePrice,
          fund.baseToken.decimals,
          fund.fundToken.decimals,
        )
      } else {
        const lastNAVUpdateTotalDepositBalance = await getFundLastNAVUpdateTotalDepositBalance(fund, fundLastNavUpdate);

        const baseTokenDecimals = fund.baseToken.decimals;
        fund.cumulativeReturnPercent = fundLastNavUpdateExists
          ? calculateCumulativeReturnPercent(
            lastNAVUpdateTotalDepositBalance || 0n,
            fund.lastNAVUpdateTotalNAV || 0n,
            baseTokenDecimals,
          )
          : 0;
      }

      fund.lastNAVUpdateTotalNAV = fundLastNavUpdateExists
        ? fund.lastNAVUpdateTotalNAV
        : fund.totalDepositBalance;
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

const getSharePriceAtNavUpdate = async (navUpdate: INAVUpdate, fund: IFund) => {
  if (navUpdate?.timestamp) {
    const web3Store = useWeb3Store();
    const blockTimeStore = useBlockTimeStore();

    // 1. get average block time for the chain
    console.warn("getSharePriceAtNavUpdate")
    const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(fund.chainId, false);
    console.warn("getSharePriceAtNavUpdate blockTimeContext", fund.chainId, blockTimeContext)

    const averageBlockTime = blockTimeContext?.averageBlockTime || 0;

    // 2. get block number for the timestamp
    const totalNav = ethers.parseUnits(String(navUpdate.totalNAV || "0"), fund?.baseToken.decimals);
    const blockNumber = Number(await blockTimeStore.getBlockByTimestamp(fund.chainId, navUpdate.timestamp / 1000, averageBlockTime) || 0);

    try {
      const totalSupplyRaw = await web3Store.callWithRetry(
        fund.chainId,
        () => {
          const fundTokenContract = web3Store.getCustomContract(
            fund.chainId,
            ERC20,
            fund.fundToken.address,
          );

          return fundTokenContract.methods.totalSupply().call({}, blockNumber);
        },
      );

      const totalSupply = ethers.parseUnits(String(totalSupplyRaw || "0"), fund.fundToken.decimals);

      // Determine the highest decimals between NAV and Supply
      const navDecimals = fund.baseToken.decimals;
      const supplyDecimals = fund.fundToken.decimals;
      const diffDecimals = navDecimals - supplyDecimals;

      // Scale totalNav to the same decimals as totalSupply for proper division
      const adjustedTotalNav = diffDecimals > 0 ? totalNav * 10n ** BigInt(diffDecimals) : totalNav;
      const adjustedTotalSupply = diffDecimals < 0 ? totalSupply * 10n ** BigInt(-diffDecimals) : totalSupply;

      // Perform the division
      const scaleFactor = 10n ** 36n; // Scale up before division to avoid precision loss
      const sharePriceBigInt = totalSupply > 0n ? (adjustedTotalNav * scaleFactor) / adjustedTotalSupply : 0n;

      // Convert to float and format the share price correctly
      const sharePrice = parseFloat(ethers.formatUnits(sharePriceBigInt, 36));

      return sharePrice;
    }
    catch(e){
      console.error("Error getting share price", e)
      return undefined;
    }
  }

  return 0;
}


const getFundLastNAVUpdateTotalDepositBalance = async (fund: IFund, fundLastNavUpdate: any) => {
  if (fundLastNavUpdate?.timestamp) {
    const web3Store = useWeb3Store();
    const blockTimeStore = useBlockTimeStore();

    // 1. get average block time for the chain
    const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(fund.chainId, false);
    const averageBlockTime = blockTimeContext?.averageBlockTime || 0;
    console.warn("getFundLastNAVUpdateTotalDepositBalance blockTimeContext", fund.chainId, blockTimeContext)

    // 2. estimate the block number of the last NAV update timestamp
    const lastNavUpdateBlockNumber = Number(await blockTimeStore.getBlockByTimestamp(fund.chainId, fundLastNavUpdate.timestamp / 1000, averageBlockTime) || 0);

    // 3. get total deposit balance at the last NAV update
    try {
      const fundContract = web3Store.getCustomContract(
        fund.chainId,
        GovernableFund.abi,
        fund.address,
      );
      return await web3Store.callWithRetry(
        fund.chainId,
        async () => {
          return BigInt(await fundContract.methods._totalDepositBal().call({}, lastNavUpdateBlockNumber) || 0)
        },
      );
    } catch (e) {
      console.error("Error getting total deposit balance at last NAV update", e);
      return null;
    }
  }

  return null;
}
