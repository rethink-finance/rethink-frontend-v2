import type { ChainId } from "~/types/enums/chain_id";
import { ethCallFrom } from "~/composables/permissions/useRoleExecution";
import {
  encodeReturnRoleProbe,
  isReturnRoleClosed,
  type ReturnRolesVersion,
} from "~/composables/onboarding/returnTestFundsCalls";

/**
 * Whether the test-funds return role is still assigned to `member` on the
 * vault's modifier: true when a return was started and never cleaned up.
 * Throws when no RPC answers — callers decide what an unknown means.
 */
export const isReturnRoleOpen = async ({
  chainId,
  version,
  rolesModAddress,
  member,
  tokenAddress,
}: {
  chainId: ChainId;
  version: ReturnRolesVersion;
  rolesModAddress: string;
  member: string;
  tokenAddress: string;
}): Promise<boolean> => {
  const { reverted, returnData } = await ethCallFrom(
    chainId,
    member,
    rolesModAddress,
    encodeReturnRoleProbe({ version, tokenAddress, member }),
  );
  return !isReturnRoleClosed(reverted, returnData);
};
