import { Web3 } from "web3";
import { fetchExplorerLogs } from "./explorerLogs";
import { fetchBlockscoutRoleLogs, toRoleScopeLog } from "./roleScopes";
import { reduceRolesV1Logs, type RolesV1Modifier } from "./rolesV1Replay";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * A Roles v1 modifier's permissions read straight off the chain — see
 * rolesV1Replay.ts for why there is no subgraph to ask any more.
 *
 * The log comes from the first source that answers: the block explorer
 * (unbounded history, a few seconds behind head), then Blockscout (no API key,
 * covers chains the explorer plan does not), then each configured RPC (at
 * head, but the public ones mostly cap the eth_getLogs range and fail fast).
 * The same tiering as services/onchain/roleScopes.ts, without its save-floor
 * check: this read only displays, it never diffs a save against itself.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Thrown when no source could serve the modifier's log. Callers must surface
 * this as "we could not load permissions" rather than as "no permissions" —
 * the two look identical otherwise.
 */
export class RolesV1UnavailableError extends Error {
  constructor(chainId: ChainId, cause?: unknown) {
    super(
      "Could not read the vault's permissions from the Roles modifier's " +
      `event log on chain ${chainId}: neither the block explorer nor any ` +
      "configured RPC answered with its history.",
    );
    this.name = "RolesV1UnavailableError";
    this.cause = cause;
  }
}

export const fetchOnChainRolesV1 = async (
  chainId: ChainId,
  rolesModAddress: string,
): Promise<RolesV1Modifier | null> => {
  const web3Store = useWeb3Store();

  const sources: (() => Promise<any[]>)[] = [
    () => fetchExplorerLogs(chainId, rolesModAddress),
    () => fetchBlockscoutRoleLogs(chainId, rolesModAddress),
    ...web3Store.networkRpcUrls(chainId).map((rpcUrl: string) => async () => {
      const web3 = new Web3(rpcUrl);
      return (await Promise.race([
        web3.eth.getPastLogs({
          address: rolesModAddress,
          fromBlock: 0,
          toBlock: "latest",
        }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error(`getPastLogs timed out on ${rpcUrl}`)),
            REQUEST_TIMEOUT_MS,
          ),
        ),
      ])) as any[];
    }),
  ];

  let answeredEmpty = false;
  let lastError: unknown;
  for (const source of sources) {
    let logs;
    try {
      logs = (await source()).map(toRoleScopeLog);
    } catch (error) {
      lastError = error;
      continue;
    }
    // A modifier that was ever set up carries at least its RolesModSetup log,
    // so an empty answer is more likely a pruned or range-capped node saying
    // [] than a modifier with no history. Keep asking; "nothing" is only the
    // answer once every source that answered agrees.
    if (!logs.length) {
      answeredEmpty = true;
      continue;
    }
    // Logs, but none of them a v1 event (a v2 modifier, or a proxy that only
    // ever emitted upgrades): every other source would say the same.
    return reduceRolesV1Logs(logs, rolesModAddress);
  }

  if (answeredEmpty) return null;
  throw new RolesV1UnavailableError(chainId, lastError);
};
