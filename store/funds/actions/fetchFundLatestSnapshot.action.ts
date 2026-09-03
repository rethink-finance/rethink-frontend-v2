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

  const response = await fetch(
    `${config.public.BACKEND_URL}/nav/latest-snapshot/${fund.address}?fundChainId=${fund.chainId}`,
  );

  if (!response.ok) {
    console.error(`Failed to fetch latest snapshot for fund ${fund.chainId} ${fund.address}:`, response.statusText);
    return fund;
  }

  const data = await response.json();
  return parseFundSnapshotResponse(fund, data);
}

/**
 * One discover load asks for a chain's snapshots twice — once for the rows
 * restored from cache, once for the rows the on-chain revalidation rebuilds —
 * and both want the same answer. Concurrent callers with the same address set
 * share one request. The raw response is what is shared, not the rows built
 * from it, so each caller still maps the answer onto its own fund objects.
 * Failures are not kept, so the next caller tries again.
 */
const SHARE_SNAPSHOTS_MS = 10 * 1000;
const snapshotsInFlight = new Map<
  string,
  { at: number; promise: Promise<any[] | null> }
>();

const loadLatestSnapshots = (
  chainId: ChainId,
  fundAddresses: string[],
): Promise<any[] | null> => {
  const key = `${chainId}:${[...fundAddresses].sort().join(",")}`;
  const hit = snapshotsInFlight.get(key);
  if (hit && Date.now() - hit.at < SHARE_SNAPSHOTS_MS) return hit.promise;

  const config = useRuntimeConfig();
  const promise = fetch(`${config.public.BACKEND_URL}/nav/latest-snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fundChainId: chainId,
      fundAddresses,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error(`Failed to fetch latest snapshot for chain ${chainId}:`, response.statusText);
        return null;
      }
      const data = await response.json();
      console.warn("Funds chainId ", chainId, " NAV SNAPSHOTS", data);
      return data;
    })
    .catch((error) => {
      console.error(`Error fetching latest snapshot for ChainId ${chainId}:`, error);
      return null;
    });
  snapshotsInFlight.set(key, { at: Date.now(), promise });
  promise.then((data) => {
    if (data === null) snapshotsInFlight.delete(key);
  });
  return promise;
};

export async function fetchFundLatestSnapshots(chainId: ChainId, funds: IFund[]): Promise<IFund[]> {
  console.warn("FETCH LATEST SNAPSHOTS ChainId ", chainId);
  const data = await loadLatestSnapshots(
    chainId,
    funds.map((fund) => fund.address),
  );
  if (!data) return funds;
  return funds.map((fund: IFund) => parseFundSnapshotResponse(fund, data.find((snapshot: any) => snapshot.fundAddress === fund.address)));
}


const parseFundSnapshotResponse = (fund: IFund, data: any): IFund => {
  // Add the current value to the fund object
  let totalSimulatedNavCalculatedAt;
  try {
    if (data?.calculatedAt) {
      totalSimulatedNavCalculatedAt = formatDateToLocaleString(new Date(data?.calculatedAt));
    }
  } catch (error: any) {
    console.error(error);
  }

  const positionTypesCounts = fund?.positionTypeCounts?.length ? fund?.positionTypeCounts : data?.positionTypeCounts?.length ? data?.positionTypeCounts : [];
  return {
    ...fund,
    totalSimulatedNavCalculatedAt,
    totalSimulatedNavCalculatedAtISO: data?.calculatedAt,
    sharePrice: data?.sharePrice,
    totalSimulatedNav: BigInt(data?.totalSimulatedNav || 0),
    totalSimulatedNavFormatted: data?.totalSimulatedNavFormatted,
    totalSimulatedNavUSD: data?.totalSimulatedNavUSD,
    totalSimulatedNavUSDFormatted: data?.totalSimulatedNavUSDFormatted,
    // Metrics
    totalDepositBalance: BigInt(data?.totalDepositBalance || 0),
    sharpeRatio: data?.sharpeRatio,
    lastNAVUpdateTotalNAV: data?.totalNAV,
    cumulativeReturnPercent: data?.cumulativeReturnPercent,
    positionTypeCounts: positionTypesCounts,
    isNavUpdatesLoading: false,
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
