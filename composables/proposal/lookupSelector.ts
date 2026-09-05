import { ethers } from "ethers";

/**
 * Last resort for naming a 4-byte selector: the public signature database.
 * Reached only when neither the ABIs we ship nor the explorer's copy of the
 * target's ABI carry the function — typically a Diamond proxy, whose facets'
 * functions are not in the diamond's own ABI.
 *
 * Returns a fragment with typed but unnamed inputs, so callers can decode
 * arguments and print `openTrade(tuple, uint16, address)`; never names.
 */
const OPENCHAIN_LOOKUP = "https://api.openchain.xyz/signature-database/v1/lookup";

const cache = new Map<string, Promise<ethers.FunctionFragment | undefined>>();

export const lookupSelectorFragment = (
  selector: string,
): Promise<ethers.FunctionFragment | undefined> => {
  const key = (selector ?? "").slice(0, 10).toLowerCase();
  if (!/^0x[0-9a-f]{8}$/.test(key)) return Promise.resolve(undefined);
  const pending = cache.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(
        `${OPENCHAIN_LOOKUP}?function=${key}&filter=true`,
      );
      if (!response.ok) return undefined;
      const body = await response.json();
      const candidates: { name: string }[] = body?.result?.function?.[key] ?? [];
      for (const candidate of candidates) {
        try {
          const fragment = ethers.FunctionFragment.from(`function ${candidate.name}`);
          if (fragment.selector.toLowerCase() === key) return fragment;
        } catch {
          // an unparsable entry, try the next
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  })();

  cache.set(key, request);
  return request;
};
