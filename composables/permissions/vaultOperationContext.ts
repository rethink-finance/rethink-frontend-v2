import { GovernableFund } from "~/assets/contracts/GovernableFund";
import type { IPrepopulatedPermissionsContext } from "~/composables/permissions/vaultRoles";
import { useContractAddresses } from "~/composables/useContractAddresses";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * What re-issuing a vault operation's grant needs on a live vault: the
 * chain's NAV executor and performance fee contract, and the vault's settings
 * as they stand now (the admin's settings grant pins every closed field to its
 * current value). Read from the vault itself, never from frontend state, the
 * same way the activation proposal reads them.
 */
export const fetchVaultOperationContext = async (options: {
  chainId: ChainId;
  fundAddress: string;
  baseToken: string;
  rolesModifier: string;
  executorRoleKey: string;
}): Promise<IPrepopulatedPermissionsContext> => {
  const web3Store = useWeb3Store();
  const addresses = useContractAddresses();
  const fund = web3Store.getCustomContract(
    options.chainId,
    GovernableFund.abi as any,
    options.fundAddress,
  );
  const [settings, fundMetadata, feePerformancePeriod, feeManagePeriod] = await Promise.all([
    fund.methods.getFundSettings().call() as Promise<Record<string, any>>,
    fund.methods.fundMetadata().call() as Promise<string>,
    fund.methods.feePerformancePeriod().call(),
    fund.methods.feeManagePeriod().call(),
  ]);
  if (!settings?.safe) throw new Error("The vault's settings could not be read.");

  return {
    fundAddress: options.fundAddress,
    baseToken: options.baseToken || settings.baseToken,
    rolesModifier: options.rolesModifier,
    executorRoleKey: options.executorRoleKey,
    chainId: options.chainId,
    navExecutor: addresses.getNAVExecutorBeaconProxyAddress(options.chainId),
    poolPerformanceFee:
      addresses.rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[options.chainId],
    rawSettings: settings,
    fundMetadata,
    // In ABI order: the performance period, then the management period.
    feePerformancePeriod,
    feeManagePeriod,
  };
};
