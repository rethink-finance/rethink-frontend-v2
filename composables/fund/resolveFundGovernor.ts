import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";
import type IFundSettings from "~/types/fund_settings";

/**
 * FundSettings.governor names whoever may call updateSettings — which stops
 * being the RethinkFundGovernor the moment a vault activates Roles v2. That
 * proposal deliberately repoints the field at the Safe (see
 * composables/permissions/activationProposal.ts), and from then on the
 * settings struct no longer tells us where governance lives: the reader
 * contract aims its governance staticcalls at settings.governor, they revert
 * against a Safe, and the whole FundGovernanceData struct comes back zeroed.
 *
 * The Safe is also the way back to the governor. The factory gives each vault
 * a Safe whose single owner is its governor, so the owner that claims this
 * vault's governance token as its own `token()` is the governor we lost.
 * Validating against the token is what makes the guess safe — a Safe owner
 * that answers with a different token, or does not answer at all, is not this
 * vault's governor and is skipped.
 */

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** chainId -> safe address (lowercase) -> resolved governor. */
const resolvedGovernors: Record<string, Record<string, string>> = {};

/**
 * The RethinkFundGovernor behind a vault, whether or not settings.governor
 * still points at it. Returns "" when the vault has moved settings authority
 * to its Safe and no owner of that Safe identifies as the governor — callers
 * should treat that as "governance address unknown" rather than fall back to
 * the settings field, which would aim every governance read at the Safe.
 */
export const resolveFundGovernorAddress = async (
  chainId: ChainId,
  fundSettings: IFundSettings,
): Promise<string> => {
  const settingsGovernor = fundSettings.governor ?? "";
  const safeAddress = fundSettings.safe ?? "";
  const governanceToken = fundSettings.governanceToken ?? "";

  // Vaults that have not activated Roles v2 — the overwhelming majority — take
  // this path and cost no extra calls.
  if (!eq(settingsGovernor, safeAddress)) return settingsGovernor;

  const cacheKey = safeAddress.toLowerCase();
  const cached = resolvedGovernors[chainId]?.[cacheKey];
  if (cached !== undefined) return cached;

  const web3Store = useWeb3Store();
  let owners: string[] = [];
  try {
    const safeContract = web3Store.getCustomContract(
      chainId,
      GnosisSafeL2JSON.abi,
      safeAddress,
    );
    owners = await web3Store.callWithRetry(chainId, () =>
      safeContract.methods.getOwners().call(),
    );
  } catch (error) {
    console.error(
      `Failed reading Safe owners while resolving the governor of ${fundSettings.fundAddress}`,
      error,
    );
  }

  let governorAddress = "";
  for (const owner of owners ?? []) {
    if (eq(owner, safeAddress)) continue;
    try {
      const governorContract = web3Store.getCustomContract(
        chainId,
        RethinkFundGovernor.abi,
        owner,
      );
      const token = (await governorContract.methods
        .token()
        .call()) as unknown as string;
      if (eq(token, governanceToken)) {
        governorAddress = owner;
        break;
      }
    } catch {
      // Not a governor (an EOA or any other owner) — keep looking.
    }
  }

  if (!governorAddress) {
    console.error(
      `Vault ${fundSettings.fundAddress} has settings.governor == safe ` +
        "(Roles v2 activated) but none of the Safe owners is its governor. " +
        "Governance data will be unavailable.",
    );
  }

  (resolvedGovernors[chainId] ??= {})[cacheKey] = governorAddress;
  return governorAddress;
};

/**
 * The subset of the reader's FundGovernanceData that the vault page needs,
 * read straight off the governor. Only used when settings.governor no longer
 * points at the governor, which is exactly when the reader's own copy is
 * zeroed.
 */
export interface IFundGovernanceData {
  votingDelay: bigint;
  votingPeriod: bigint;
  proposalThreshold: bigint;
  lateQuorumVoteExtension: bigint;
  quorumNumerator: bigint;
  quorumDenominator: bigint;
  clockMode: string;
}

export const fetchGovernorGovernanceData = async (
  chainId: ChainId,
  governorAddress: string,
): Promise<IFundGovernanceData | null> => {
  const web3Store = useWeb3Store();
  const governorContract = web3Store.getCustomContract(
    chainId,
    RethinkFundGovernor.abi,
    governorAddress,
  );
  const read = (method: string) =>
    web3Store.callWithRetry(chainId, () =>
      governorContract.methods[method]().call(),
    );

  try {
    const [
      votingDelay,
      votingPeriod,
      proposalThreshold,
      lateQuorumVoteExtension,
      quorumNumerator,
      quorumDenominator,
      clockMode,
    ] = await Promise.all([
      read("votingDelay"),
      read("votingPeriod"),
      read("proposalThreshold"),
      read("lateQuorumVoteExtension"),
      read("quorumNumerator"),
      read("quorumDenominator"),
      read("CLOCK_MODE"),
    ]);

    return {
      votingDelay: BigInt(votingDelay),
      votingPeriod: BigInt(votingPeriod),
      proposalThreshold: BigInt(proposalThreshold),
      lateQuorumVoteExtension: BigInt(lateQuorumVoteExtension),
      quorumNumerator: BigInt(quorumNumerator),
      quorumDenominator: BigInt(quorumDenominator),
      clockMode: clockMode as string,
    };
  } catch (error) {
    console.error(
      `Failed reading governance data from governor ${governorAddress}`,
      error,
    );
    return null;
  }
};
