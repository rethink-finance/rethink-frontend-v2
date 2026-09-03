import { useFundStore } from "../fund.store";
import type { ChainId } from "~/types/enums/chain_id";
import { parseNavMethodsPositionTypeCounts } from "~/composables/nav/parseNavMethodsPositionTypeCounts";
import type IFund from "~/types/fund";
import { fetchFundLatestSnapshotAction } from "~/store/funds/actions/fetchFundLatestSnapshot.action";
import { readCachedLastNavUpdate } from "~/store/funds/fundsCache";
import {
  patchCachedFundOverview,
  readCachedFundOverview,
} from "~/store/funds/fundOverviewCache";
import { useActionStateStore } from "~/store/actionState.store";
import { ActionState } from "~/types/enums/action_state";

/**
 * Serves last visit's page before anything is fetched: the fund object, the
 * backend NAV feeds and the last NAV update with its simulated values, so
 * every section has what it renders on the first frame. Each fetch in
 * fetchFundDataAction then refreshes its part in place. A vault never opened
 * before has no entry and waits behind the skeletons, as it always did.
 */
const hydrateFundFromCache = (
  fundChainId: ChainId,
  fundAddress: string,
): boolean => {
  const fundStore = useFundStore();
  const cached = readCachedFundOverview(fundChainId, fundAddress);
  if (!cached?.fund?.address) return false;

  const fund: IFund = {
    ...cached.fund,
    navUpdates: [],
    backendNavUpdates: cached.backendNavUpdates,
    backendDailyNavSnapshots: cached.backendDailyNavSnapshots,
  };
  const lastNavUpdate = readCachedLastNavUpdate(fundChainId, fundAddress);
  if (lastNavUpdate) {
    fund.navUpdates = [lastNavUpdate];
    fund.lastNAVUpdateTotalNAV =
      lastNavUpdate.totalNAV ?? fund.lastNAVUpdateTotalNAV;
  }
  fundStore.chainFunds[fundChainId][fundAddress] = fund;
  if (cached.initialNavMethods?.length) {
    fundStore.fundInitialNAVMethods = cached.initialNavMethods;
  }
  return true;
};

export const fetchFundDataAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData(fundChainId, fundAddress);
  fundStore.selectedFundChain = fundChainId;
  fundStore.selectedFundAddress = fundAddress;
  // Nothing has asked for this vault's NAV history yet, whatever the previous
  // vault left the flag at. Sections that wait for a complete history read it.
  useActionStateStore().setActionState(
    "fetchFundNAVDataAction",
    ActionState.Idle,
  );
  hydrateFundFromCache(fundChainId, fundAddress);
  try {
    await fundStore.fetchFundMetaData(fundChainId, fundAddress);
    // TODO everything necessary is already fetched in the fundLatestSnapshotAction, so use this only as a fallback
    // Refactor the fetchFundNAVDataAction, as there are still some things that need to be set like: fundManagedNAVMethods
    fundStore.fetchFundNAVData();

    // Captured now: by the time the snapshot lands the store may already be
    // showing a different vault, and its figures must not be written there.
    const fund = fundStore.fund;
    if (fund) {
      fetchFundLatestSnapshotAction(fund).then((fundWithSnapshotData: IFund) => {
        console.debug("fetchFundLatestSnapshotAction", fundChainId, fundAddress, fundWithSnapshotData);
        Object.assign(fund, fundWithSnapshotData);
        patchCachedFundOverview(fundChainId, fundAddress, { fund });
      }).catch((error) => {
        console.error(`Failed fetching latest snapshot for ${fundAddress}`, error);

        // Fallback to previous nav update.
        setLastNavUpdatePositionTypeCounts(fund);
        fundStore.calculateFundPerformanceMetrics(fund);
      });
    }

    // Fetch user deposit & redemption requests async, no need to wait for it to finish.
    fundStore.fetchUserFundData(fundChainId, fundAddress);
    fundStore.fetchFundPendingDepositRedemptionBalance();
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};

const setLastNavUpdatePositionTypeCounts = (fund?: IFund) => {
  if (!fund || !fund.navUpdates?.length) return;

  const navUpdates = fund.navUpdates;
  const lastNavUpdate = navUpdates[navUpdates.length - 1];

  fund.positionTypeCounts = parseNavMethodsPositionTypeCounts(lastNavUpdate);
}
