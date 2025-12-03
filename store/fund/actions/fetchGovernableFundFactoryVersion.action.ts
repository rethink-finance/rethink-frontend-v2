import { fetchFundsInfoArrays } from "~/store/funds/actions/fetchFundsInfoArrays.action";
import type { ChainId } from "~/types/enums/chain_id";

export const fetchGovernableFundFactoryVersionAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<any> => {
  let version = "v1";

  const v2FundInfos = await fetchFundsInfoArrays(fundChainId, "v2");
  try {
    if (v2FundInfos[0].includes(fundAddress)) {
      version = "v2";
    }
  } catch (e) {
    console.error(
      "Failed to determine if GovernableFundFactory is version v2, error. -> ",
      e,
    );
  }

  return version;
};
