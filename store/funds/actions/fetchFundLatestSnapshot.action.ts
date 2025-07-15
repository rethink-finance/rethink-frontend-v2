import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import { useActionState } from "~/store/actionState.store";


export function fetchFundLatestSnapshotAction(fund: IFund): Promise<IFund> {
  return useActionState(`fetchFundLatestSnapshot_${fund.chainId}_${fund.address}`, () =>
    fetchFundLatestSnapshot(fund),
  );
}

export function fetchFundLatestSnapshotsAction(chainId: ChainId, funds: IFund[]): Promise<IFund[]> {
  return useActionState(`fetchFundLatestSnapshots_${chainId}`, () =>
    fetchFundLatestSnapshots(chainId, funds),
  );
}

/**
 * Fetches the latest snapshot for a fund and adds the current value to the fund object.
 * @param fund The fund object to update
 * @returns The updated fund object
 */
export async function fetchFundLatestSnapshot(fund: IFund): Promise<IFund> {
  console.warn("FETCH LATEST SNAPSHOT Fund ", fund.chainId, fund.address);
  const config = useRuntimeConfig();
  try {
    const start = performance.now(); // Start timer

    const response = await fetch(
      `${config.public.BACKEND_URL}/nav/latest-snapshot/${fund.address}?fundChainId=${fund.chainId}`,
    );
    const end = performance.now(); // End timer
    console.log(
      `⏱ Fetch latest snapshot for fund ${fund.chainId} ${fund.address} took ${Math.round(end - start)}ms`,
    );
    if (!response.ok) {
      console.error(`Failed to fetch latest snapshot for fund ${fund.chainId} ${fund.address}:`, response.statusText);
      return fund;
    }

    const data = await response.json();
    console.warn("Fund ", fund.chainId, fund.address," NAV SNAPSHOT", data);
    return parseFundSnapshotResponse(fund, data);
  } catch (error) {
    console.error(`Error fetching latest snapshot for fund ${fund.chainId} ${fund.address}:`, error);
    return fund;
  }
}

export async function fetchFundLatestSnapshots(chainId: ChainId, funds: IFund[]): Promise<IFund[]> {
  console.warn("FETCH LATEST SNAPSHOTS ChainId ", chainId);
  const config = useRuntimeConfig();
  try {
    const start = performance.now(); // Start timer
    const fundAddresses = funds.map((fund) => fund.address);
    const response = await fetch(
      `${config.public.BACKEND_URL}/nav/latest-snapshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fundChainId: chainId,
          fundAddresses,
        }),
      },
    );
    const end = performance.now(); // End timer
    console.log(
      `⏱ Fetch latest snapshot for chain ${chainId} took ${Math.round(end - start)}ms`,
    );
    if (!response.ok) {
      console.error(`Failed to fetch latest snapshot for chain ${chainId}:`, response.statusText);
      return funds;
    }

    const data = await response.json();
    console.warn("Funds chainId ", chainId, " NAV SNAPSHOTS", data);
    return funds.map((fund: IFund) => parseFundSnapshotResponse(fund, data.find((snapshot: any) => snapshot.fundAddress === fund.address)));
  } catch (error) {
    console.error(`Error fetching latest snapshot for ChainId ${chainId}:`, error);
    return funds;
  }
}


const parseFundSnapshotResponse = (fund: IFund, data: any): IFund => {
  // Add the current value to the fund object
  let totalSimulatedNavCalculatedAt;
  try {
    if (data?.calculatedAt) {
      totalSimulatedNavCalculatedAt = formatDateToLocaleString(new Date(data.calculatedAt));
    }
  } catch (error: any) {
    console.error(error);
  }

  const positionTypesCounts = fund?.positionTypeCounts?.length ? fund?.positionTypeCounts : data?.positionTypeCounts?.length ? data.positionTypeCounts : [];
  return {
    ...fund,
    totalSimulatedNavCalculatedAt,
    totalSimulatedNav: BigInt(data.totalSimulatedNav),
    totalSimulatedNavFormatted: data.totalSimulatedNavFormatted,
    totalSimulatedNavUSD: data.totalSimulatedNavUSD,
    totalSimulatedNavUSDFormatted: data.totalSimulatedNavUSDFormatted,
    // Metrics
    totalDepositBalance: data.totalDepositBalance,
    sharpeRatio: data.sharpeRatio,
    lastNAVUpdateTotalNAV: data.totalNAV,
    cumulativeReturnPercent: data.cumulativeReturnPercent,
    positionTypeCounts: positionTypesCounts,
    // isNavUpdatesLoading: false,
  };
}

/**
 * Fetches the latest snapshot for multiple funds.
 * @param funds The array of fund objects to update
 * @returns The updated array of fund objects
 */
export function fetchFundsLatestSnapshotsAction(funds: IFund[]): Promise<IFund[]> {
  if (!funds.length) {
    return Promise.resolve([]);
  }
  return fetchFundLatestSnapshotsAction(funds[0].chainId, funds);
  // Process funds in parallel
  // const updatedFundsPromises = funds.map(fund => fetchFundLatestSnapshotAction(fund));

  // Wait for all promises to resolve
  // return Promise.all(updatedFundsPromises);
}
