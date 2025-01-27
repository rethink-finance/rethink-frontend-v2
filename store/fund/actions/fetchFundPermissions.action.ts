import { fetchRoles } from "~/services/zodiac-subgraph";
import type { ChainId } from "~/store/web3/networksMap";
import type { Role } from "~/types/zodiac-roles/role";

export const fetchFundPermissionsAction = (
  fundChainId: ChainId,
  rolesModAddress: string,
): Promise<Role[]> => {
  // Async fetch Zodiac roles:
  return fetchRoles(
    fundChainId,
    rolesModAddress,
  );
};
