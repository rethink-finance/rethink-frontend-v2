import { useFundStore } from "../fund.store";
import type { ChainId } from "~/types/enums/chain_id";
import { parseNavMethodsPositionTypeCounts } from "~/composables/nav/parseNavMethodsPositionTypeCounts";
import type IFund from "~/types/fund";
import { fetchFundLatestSnapshotAction } from "~/store/funds/actions/fetchFundLatestSnapshot.action";

export const fetchFundDataAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData(fundChainId, fundAddress);
  fundStore.selectedFundChain = fundChainId;
  fundStore.selectedFundAddress = fundAddress;
  try {
    await fundStore.fetchFundMetaData(fundChainId, fundAddress);
    // TODO everything necessary is already fetched in the fundLatestSnapshotAction, so use this only as a fallback
    // Refactor the fetchFundNAVDataAction, as there are still some things that need to be set like: fundManagedNAVMethods
    fundStore.fetchFundNAVData();

    if (fundStore.fund) {
      fetchFundLatestSnapshotAction(fundStore.fund).then((fundWithSnapshotData: IFund) => {
        console.warn("TTT fetchFundLatestSnapshotAction DONE111", fundChainId, fundAddress, fundWithSnapshotData);
        Object.assign(fundStore.fund!, fundWithSnapshotData);
        console.warn("TTT fetchFundLatestSnapshotAction DONE222", fundChainId, fundAddress, fundStore.fund);
      }).catch((error) => {
        console.error(`Failed fetching latest snapshot for ${fundAddress}`, error);

        // Fallback to previous nav update.
        setLastNavUpdatePositionTypeCounts(fundStore.fund);
        fundStore.calculateFundPerformanceMetrics(fundStore.fund);
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
