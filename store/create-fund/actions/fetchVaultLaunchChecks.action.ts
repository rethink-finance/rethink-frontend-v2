import { GovernableFund } from "assets/contracts/GovernableFund";
import { RethinkFundGovernor } from "assets/contracts/RethinkFundGovernor";
import { isZeroAddress } from "~/composables/addressUtils";
import {
  evaluateVaultLaunchChecks,
  type IVaultLaunchCheck,
} from "~/composables/vaultLaunchChecks";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";
import type IFundInitCache from "~/types/fund_init_cache";

/**
 * The fees the finalized vault will charge, as basis points.
 *
 * Read off the deployed vault contract when it already answers, and off the
 * factory's initialization cache otherwise — the cache is the struct finalize
 * writes into the vault, so the two agree by construction. Neither is the form:
 * the point is to check what was deployed, not what was typed.
 */
const fetchFeesBps = async (
  fundChainId: ChainId,
  fundInitCache: IFundInitCache,
) => {
  const web3Store = useWeb3Store();
  const fromCache = fundInitCache.fundSettings ?? ({} as IFundInitCache["fundSettings"]);

  if (fundInitCache.fundContractAddr && !isZeroAddress(fundInitCache.fundContractAddr)) {
    try {
      const fundContract = web3Store.getCustomContract(
        fundChainId,
        GovernableFund.abi,
        fundInitCache.fundContractAddr,
      );
      const deployed = await web3Store.callWithRetry(
        fundChainId,
        () => fundContract.methods.getFundSettings().call(),
        1,
      );
      // An uninitialized proxy answers with an empty struct; only a vault that
      // knows its denomination asset is reporting settings worth checking.
      if (deployed?.baseToken && !isZeroAddress(deployed.baseToken)) {
        return {
          depositFeeBps: deployed.depositFee,
          withdrawFeeBps: deployed.withdrawFee,
          managementFeeBps: deployed.managementFee,
          performanceFeeBps: deployed.performanceFee,
          source: "vault" as const,
        };
      }
    } catch (error) {
      console.warn("The vault contract did not report its settings yet; reading the factory cache", error);
    }
  }

  return {
    depositFeeBps: fromCache.depositFee,
    withdrawFeeBps: fromCache.withdrawFee,
    managementFeeBps: fromCache.managementFee,
    performanceFeeBps: fromCache.performanceFee,
    source: "factory" as const,
  };
};

/**
 * Runs the finalize step's contract checks against the vault a deployer has
 * initialized: the governor's quorum and voting period are read from the
 * governor itself, the fees from the vault, and the voting period is turned
 * into a duration with the block time of the chain the governor counts on.
 *
 * Throws when the governor cannot be reached at all, so the caller can show a
 * "could not check" state rather than a list of unknowns; a single value that
 * will not read comes back as an "unknown" check instead.
 */
export const fetchVaultLaunchChecksAction = async (
  fundChainId: ChainId,
  fundInitCache: IFundInitCache,
): Promise<IVaultLaunchCheck[]> => {
  const web3Store = useWeb3Store();
  const blockTimeStore = useBlockTimeStore();

  const governorAddress = fundInitCache.fundSettings?.governor;
  if (!governorAddress || isZeroAddress(governorAddress)) {
    throw new Error("The initialized vault has no governor to check.");
  }

  const governorContract = web3Store.getCustomContract(
    fundChainId,
    RethinkFundGovernor.abi,
    governorAddress,
  );
  const readGovernor = (method: string) =>
    web3Store.callWithRetry(fundChainId, () =>
      governorContract.methods[method]().call(),
    );

  const [quorumNumerator, quorumDenominator, votingPeriod, fees, blockTimeContext] =
    await Promise.all([
      readGovernor("quorumNumerator"),
      readGovernor("quorumDenominator"),
      readGovernor("votingPeriod"),
      fetchFeesBps(fundChainId, fundInitCache),
      // The governor counts blocks on the L1 for a rollup that inherits its
      // block number, which is the chain initializeBlockTimeContext maps to.
      blockTimeStore.initializeBlockTimeContext(fundChainId).catch((error) => {
        console.error("Could not read the block time for the voting period check", error);
        return undefined;
      }),
    ]);

  console.debug("vault launch checks read", {
    quorumNumerator,
    quorumDenominator,
    votingPeriod,
    fees,
    averageBlockTime: blockTimeContext?.averageBlockTime,
  });

  return evaluateVaultLaunchChecks({
    quorumNumerator,
    quorumDenominator,
    votingPeriodBlocks: votingPeriod,
    averageBlockTime: blockTimeContext?.averageBlockTime ?? 0,
    depositFeeBps: fees.depositFeeBps,
    withdrawFeeBps: fees.withdrawFeeBps,
    managementFeeBps: fees.managementFeeBps,
    performanceFeeBps: fees.performanceFeeBps,
  });
};
