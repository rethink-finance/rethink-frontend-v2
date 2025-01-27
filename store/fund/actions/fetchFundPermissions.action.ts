import { fetchRoles } from "~/services/zodiac-subgraph";
import type { ChainId } from "~/store/web3/networksMap";

export const fetchFundPermissionsAction = async (
  fundChainId: ChainId,
  rolesModAddress: string,
): Promise<any> => {
  // Async fetch Zodiac roles:
  console.log("GET ZODIAC roles:");
  const roles = await fetchRoles(
    fundChainId,
    rolesModAddress,
  );
  console.log("PARSED ZODIAC roles:", roles);
};
