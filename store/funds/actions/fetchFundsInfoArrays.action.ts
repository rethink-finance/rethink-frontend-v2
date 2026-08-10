// actions/fetchFundsInfoArrays.action.ts
import { useWeb3Store } from "~/store/web3/web3.store";
import { type ChainId } from "~/types/enums/chain_id";

/**
 * Fetches fund information arrays from the FundFactory contracts (V1 and optional V2)
 * for a given chain. The function:
 *
 * 1. Always queries the original FundFactory contract (V1).
 * 2. Optionally queries the FundFactoryV2 contract if it exists.
 * 3. Adds a `fundFactoryContractV2Used` flag to each returned fund entry.
 * 4. Merges V1 and V2 results into a single `[addresses[], fundData[]]` array.
 *
 * Return shape:
 * [
 *   string[], // Array of fund addresses
 *   FundDataEntry[]  // Array of fund metadata objects
 * ]
 *
 * If the V2 contract is missing or fails to respond, only V1 data is returned.
 *
 * Uses the unified `fetchFundsRaw` helper function that can work with either V1 or V2 contracts.
 *
 * @param chainId - The blockchain network identifier used to select contracts.
 * @returns A Promise resolving to a merged `[addresses[], fundData[]]` structure.
 * @throws If the main FundFactory contract (V1) is not found.
 */
export async function fetchFundsInfoArraysAction(
  chainId: ChainId,
): Promise<any[]> {
  const web3Store = useWeb3Store();

  const { fundFactoryContract, fundFactoryContractV2 } =
  web3Store.chainContracts[chainId] ?? {};

  if (!fundFactoryContract) {
    throw new Error(`No fund factory contract found for chainId: ${chainId}`);
  }

  // V1 and V2 are independent factories, so query them at the same time
  // rather than back to back — this is on the critical path before a single
  // row can render, and each call is a full RPC round trip.
  const [v1Result, v2Result] = await Promise.allSettled([
    fetchFundsInfoArrays(chainId, "v1"),
    fetchFundsInfoArrays(chainId, "v2"),
  ]);

  if (v1Result.status === "rejected") {
    throw v1Result.reason;
  }
  const v1Data = v1Result.value;

  if (v2Result.status === "rejected") {
    console.warn(`Error fetching/merging V2 data: ${v2Result.reason}`);
    return v1Data;
  }
  console.warn("V2 funds", v2Result.value)

  // Merge V1 + V2 results
  return [
    [...v1Data[0], ...v2Result.value[0]],
    [...v1Data[1], ...v2Result.value[1]],
  ];
}


/**
 * Fetches fund information from either V1 or V2 FundFactory contract
 *
 * @param chainId - The blockchain network identifier used to select contracts
 * @param version - The version of the contract to use ("v1" or "v2")
 * @returns A Promise resolving to a `[addresses[], fundData[]]` structure
 */
export async function fetchFundsInfoArrays(
  chainId: ChainId,
  version: "v1" | "v2" = "v2",
): Promise<[string[], any[]]> {
  const web3Store = useWeb3Store();
  const emptyResultData: [string[], any[]] = [[], []];

  // Get the appropriate contract based on version
  const isV2 = version === "v2";
  const contractKey = isV2 ? "fundFactoryContractV2" : "fundFactoryContract";
  const fundFactoryContract = web3Store.chainContracts[chainId]?.[contractKey];

  // -------------------------
  // Fetch data if contract is available
  // -------------------------
  if (!fundFactoryContract) {
    return emptyResultData;
  }

  try {
    const fundsLength = await web3Store.callWithRetry(
      chainId,
      () => fundFactoryContract.methods.registeredFundsLength().call(),
    );

    if (fundsLength === 0) {
      return emptyResultData;
    }

    const rawData = await web3Store.callWithRetry(
      chainId,
      () => fundFactoryContract.methods.registeredFundsData(0, fundsLength).call(),
    );

    return [
      rawData[0],
      rawData[1].map((fund: any) => ({
        ...fund,
        fundFactoryContractV2Used: isV2,
      })),
    ];
  } catch (err) {
    console.warn(`Error fetching ${version.toUpperCase()} data: ${err}`);
  }

  return emptyResultData;
}
