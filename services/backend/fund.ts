import type { ChainId } from "~/types/enums/chain_id";

/**
 * The vault-metadata snapshot the backend assembles, so the browser does not
 * have to walk the chain of dependent reads itself.
 *
 * That chain — reader struct → Safe owners → governor getters → governance
 * token supply → the V1.5 factory's registered set — is serial by construction:
 * each link needs an address from the one before. It costs round trips rather
 * than work, which is why it hurts most exactly where round trips are dearest.
 * On HyperEVM it ran to roughly 1.2s before the vault page had anything to
 * render.
 *
 * Soft-fails to null: every read it replaces is still in the store as the
 * fallback path, so a backend that is down, cold or not deployed yet costs the
 * old latency and nothing else.
 */
export interface IBackendFundMetadata {
  fetchedAt: string;
  chainId: ChainId;
  fundAddress: string;
  fundMetaData: Record<string, any>;
  governorAddress: string;
  governanceData: Record<string, any>;
  governanceTokenSupply: string;
  factoryVersion: "v1" | "v2";
}

/**
 * Fields the store consumes as bigints. The wire carries them as strings —
 * JSON has no bigint — and handing a string to `feeBalance * -1n` or to the
 * quorum division throws, so they are revived by name rather than by guessing
 * at what looks numeric. A vault's metadata JSON is a string that can hold
 * digits; type-sniffing would corrupt it.
 */
const METADATA_BIGINT_FIELDS = [
  "totalDepositBal",
  "feeBalance",
  "fundTokenSupply",
  "fundBaseTokenSupply",
  "fundGovernanceTokenSupply",
  "safeContractBaseTokenBalance",
  "fundContractBaseTokenBalance",
  "fundTokenDecimals",
  "fundBaseTokenDecimals",
  "fundGovernanceTokenDecimals",
  "startTime",
  "feePerformancePeriod",
  "feeManagePeriod",
] as const;

const GOVERNANCE_BIGINT_FIELDS = [
  "votingDelay",
  "votingPeriod",
  "proposalThreshold",
  "lateQuorumVoteExtension",
  "quorumNumerator",
  "quorumDenominator",
] as const;

const toBigInt = (value: unknown): bigint => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};

const reviveBigints = (
  source: Record<string, any>,
  fields: readonly string[],
): Record<string, any> => {
  const out = { ...source };
  for (const field of fields) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = toBigInt(out[field]);
    }
  }
  return out;
};

export const fetchBackendFundMetadata = async (
  chainId: ChainId,
  fundAddress: string,
): Promise<IBackendFundMetadata | null> => {
  const config = useRuntimeConfig();
  try {
    const response = await fetch(
      `${config.public.BACKEND_URL}/fund/metadata/${fundAddress}?fundChainId=${chainId}`,
    );
    if (!response.ok) {
      // 503 is the backend saying "ask the chain yourself" — expected whenever
      // it cannot reach an RPC, and not worth an error line.
      if (response.status !== 503 && response.status !== 404) {
        console.error(
          "[BACKEND] fund metadata fetch failed:",
          response.statusText,
        );
      }
      return null;
    }

    const snapshot = (await response.json()) as IBackendFundMetadata;
    if (!snapshot?.fundMetaData?.fundSettings) return null;

    return {
      ...snapshot,
      fundMetaData: reviveBigints(snapshot.fundMetaData, METADATA_BIGINT_FIELDS),
      governanceData: reviveBigints(
        snapshot.governanceData ?? {},
        GOVERNANCE_BIGINT_FIELDS,
      ),
    };
  } catch (error) {
    console.error("[BACKEND] fund metadata fetch error:", error);
    return null;
  }
};
