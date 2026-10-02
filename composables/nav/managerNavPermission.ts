import { ethers } from "ethers";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  defaultRoleFor,
  simulateRoleExecution,
} from "~/composables/permissions/useRoleExecution";
import type { ChainId } from "~/types/enums/chain_id";
import type { RolesVersion } from "~/types/enums/roles_version";

const fundIface = new ethers.Interface(GovernableFund.abi as any);

/**
 * Does the manager's role already hold executeNAVUpdate(navExecutor) on the
 * vault? Asked before sending the grant, so a vault whose Permissions step
 * already switched "Update NAV" on is not asked for a second transaction
 * that changes nothing.
 *
 * The modifier answers it itself: executeNAVUpdate is dry-run through
 * execTransactionWithRole from the connected wallet. The permission layer
 * runs before the wrapped call, so the call going through, or reverting on
 * the vault (ModuleTransactionFailed: nothing stored yet, say), both prove
 * the role holds it for THIS executor. Reading it this way needs no log
 * history (Roles v2 has no getter for its scopes) and checks the pinned
 * executor argument for free.
 *
 * Anything else is "not proven" and answers false: a denial, a wallet that
 * is not a member of the role, an RPC that would not answer. The grant is
 * idempotent, so sending it once too often costs a transaction; skipping it
 * wrongly would leave the manager unable to update NAV.
 */
export const managerCanExecuteNavUpdate = async (
  chainId: ChainId,
  rolesModAddress: string,
  fundAddress: string,
  navExecutorAddress: string,
  version: RolesVersion,
  role?: string,
): Promise<boolean> => {
  try {
    const result = await simulateRoleExecution(
      chainId,
      rolesModAddress,
      {
        to: fundAddress,
        data: fundIface.encodeFunctionData("executeNAVUpdate", [
          navExecutorAddress,
        ]),
      },
      role ?? defaultRoleFor(version),
      version,
    );
    return result.ok || result.innerRevert === true;
  } catch (error) {
    console.warn("Could not check the manager's NAV permission", error);
    return false;
  }
};
