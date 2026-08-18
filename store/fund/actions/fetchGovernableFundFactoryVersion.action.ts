import { fetchFundsInfoArrays } from "~/store/funds/actions/fetchFundsInfoArrays.action";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Which factory a vault came out of, cached per chain for the page's lifetime.
 *
 * The answer is a property of the chain, not of the vault: it is the V1.5
 * factory's whole registered set, read with `registeredFundsLength()` then
 * `registeredFundsData(0, length)` — two serial round trips that pull every
 * fund's full struct just to test one address for membership. That ran again on
 * every vault page load, at the END of the load's serial chain, and the curator
 * Vault Profile page renders off its result, so those two round trips sat
 * directly in front of the form. New funds appear only on a deploy, so a reload
 * is a fine granularity to refresh at.
 */
const v2FundAddresses: Partial<Record<ChainId, Promise<Set<string>>>> = {};

const loadV2FundAddresses = async (chainId: ChainId): Promise<Set<string>> => {
  const [addresses] = await fetchFundsInfoArrays(chainId, "v2");
  // Lowercased on both sides below: the factory returns EIP-55 checksummed
  // addresses while the caller's comes off the route slug, which is whatever
  // case the link was built with. An exact-match compare made every V2 vault
  // reached by a lowercase URL report as V1 — and a V2 vault reporting V1 is
  // what puts "needs a Roles V2 vault" in front of a curator who has one.
  return new Set((addresses ?? []).map((address) => address.toLowerCase()));
};

export const fetchGovernableFundFactoryVersionAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<any> => {
  try {
    // Cache the promise, not the result: concurrent vault loads on one chain
    // would otherwise each start their own copy of the same two round trips.
    v2FundAddresses[fundChainId] ??= loadV2FundAddresses(fundChainId);
    const addresses = await v2FundAddresses[fundChainId]!;
    return addresses.has((fundAddress ?? "").toLowerCase()) ? "v2" : "v1";
  } catch (e) {
    // Don't cache a failure — the next vault page should get a real attempt.
    delete v2FundAddresses[fundChainId];
    console.error(
      "Failed to determine if GovernableFundFactory is version v2, error. -> ",
      e,
    );
    return "v1";
  }
};
