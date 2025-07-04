import type IFund from "~/types/fund";

/**
 * Fetches the latest snapshot for a fund and adds the current value to the fund object.
 * @param fund The fund object to update
 * @returns The updated fund object
 */
export async function fetchFundLatestSnapshotAction(fund: IFund): Promise<IFund> {
  console.warn("FETCH LATEST SNAPSHOT Fund ", fund.chainId, fund.address);
  const config = useRuntimeConfig();
  try {
    const response = await fetch(
      `${config.public.BACKEND_URL}/nav/latest-snapshot/${fund.address}?fundChainId=${fund.chainId}`,
    );

    if (!response.ok) {
      console.error(`Failed to fetch latest snapshot for fund ${fund.chainId} ${fund.address}:`, response.statusText);
      return fund;
    }

    const data = await response.json();
    console.warn("Fund ", fund.chainId, fund.address," NAV SNAPSHOT", data);

    // Add the current value to the fund object
    let currentValueCalculatedAt;
    try {
      if (data?.calculatedAt) {
        currentValueCalculatedAt = formatDateToLocaleString(new Date(data.calculatedAt));
      }
    } catch (error: any) {
      console.error(error);
    }
    return {
      ...fund,
      currentValueCalculatedAt,
      currentValue: BigInt(data.totalSimulatedNav),
      currentValueFormatted: data.totalSimulatedNavFormatted,
    };
  } catch (error) {
    console.error(`Error fetching latest snapshot for fund ${fund.chainId} ${fund.address}:`, error);
    return fund;
  }
}

/**
 * Fetches the latest snapshot for multiple funds.
 * @param funds The array of fund objects to update
 * @returns The updated array of fund objects
 */
export async function fetchFundsLatestSnapshotsAction(funds: IFund[]): Promise<IFund[]> {
  // Process funds in parallel
  const updatedFundsPromises = funds.map(fund => fetchFundLatestSnapshotAction(fund));

  // Wait for all promises to resolve
  const updatedFunds = await Promise.all(updatedFundsPromises);

  return updatedFunds;
}
