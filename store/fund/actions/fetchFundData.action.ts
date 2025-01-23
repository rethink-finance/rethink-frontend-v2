import { useFundStore } from "../fund.store";
import { fetchRoles } from "~/services/zodiac-subgraph";

export const fetchFundDataAction = async (
  fundChainId: string,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData(fundChainId, fundAddress);
  fundStore.selectedFundChain = fundChainId;
  fundStore.selectedFundAddress = fundAddress;
  try {
    await fundStore.fetchFundMetaData(fundChainId, fundAddress);
    await fundStore.fetchFundNAVData();

    fundStore.calculateFundPerformanceMetrics();
    fundStore.fetchUserFundData(fundChainId, fundAddress);

    fundStore.fetchFundPendingDepositRedemptionBalance();

    // const rolesModAddress = await fundStore.getRoleModAddress(fundStore.fundAddress);
    // Async fetch roles:
    // const roles = await fetchRoles(
    //   fundChainId,
    //   rolesModAddress,
    // );
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
