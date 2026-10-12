import { ethers } from "ethers";
import { formatTokenValue } from "~/composables/formatters";

/**
 * A governor keeps its numbers (proposal threshold, quorum, voting power) in
 * raw vote units and compares them against getVotes() with no decimals
 * applied. These helpers are the one place the app turns those units into a
 * token amount and back, so the create flow and every vault page agree.
 *
 * A vault governed by its own shares mints one share per smallest unit of its
 * base token whatever decimals() the share token declares (the same rule as
 * calculateSharePrice), so its votes read at the base token's scale. An
 * external governance token reads at its own. The monitoring page's
 * shareDecimals applies the same rule.
 *
 * Why this exists: ShineDAO Treasury was created with a threshold typed as
 * "150000" and sent unscaled, so the governor held 150000 wei, the vault page
 * printed "150,000 vewveSHN", and an attacker with 39.97 votes could propose.
 */

/** The vault's own shares carry the votes: no token set, or the vault itself. */
export const isSelfGoverned = (
  governanceToken?: string,
  fundAddress?: string,
): boolean => {
  if (!governanceToken || governanceToken === ethers.ZeroAddress) return true;
  return (
    !!fundAddress &&
    governanceToken.toLowerCase() === fundAddress.toLowerCase()
  );
};

export const governanceVoteDecimals = (params: {
  governanceToken?: string;
  fundAddress?: string;
  baseTokenDecimals?: number | bigint | string;
  governanceTokenDecimals?: number | bigint | string;
}): number => {
  const chosen = isSelfGoverned(params.governanceToken, params.fundAddress)
    ? params.baseTokenDecimals
    : params.governanceTokenDecimals;
  const decimals = Number(chosen);
  return Number.isInteger(decimals) && decimals >= 0 ? decimals : 18;
};

/**
 * Tokens as a person types them ("150000", "0.5") to the raw vote units the
 * governor is constructed with. Empty means no threshold. Anything that is not
 * a non-negative number throws, because sending a guess would recreate the
 * ShineDAO deployment.
 */
export const toVoteUnits = (
  tokens: string | number | null | undefined,
  decimals: number,
): bigint => {
  const text = String(tokens ?? "").trim();
  if (text === "") return 0n;
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`Proposal threshold "${text}" is not a non-negative number.`);
  }
  return ethers.parseUnits(text, decimals);
};

/** Raw vote units back to the plain token amount a form field holds. */
export const fromVoteUnits = (
  units: bigint | string | number,
  decimals: number,
): string => {
  const text = ethers.formatUnits(BigInt(units), decimals);
  // formatUnits always prints a fraction ("150000.0"); a form field should not.
  return text.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0*$/, "");
};

/** What the vault pages print for a threshold: "1,000 tSHN", "0 votes". */
export const formatProposalThreshold = (
  units: bigint | string | number,
  decimals: number,
  symbol?: string,
): string => {
  const amount = formatTokenValue(BigInt(units), decimals);
  return `${amount} ${symbol || "votes"}`;
};
