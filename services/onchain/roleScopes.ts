import { Web3 } from "web3";
import { ethers } from "ethers";
import { fetchExplorerLogs } from "./explorerLogs";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import type { IPermissionScope } from "~/composables/permissions/revokePermissions";
import { useWeb3Store } from "~/store/web3/web3.store";
import { BLOCKSCOUT_BASE_URLS, type ChainId } from "~/types/enums/chain_id";

/**
 * What a role currently grants, reconstructed from the Roles modifier's own
 * event log.
 *
 * Roles v2 keeps its `roles` mapping internal and exposes no getter, so the
 * only chain-derived read of "what is granted right now" is a replay of the
 * modifier's permission events. The authoritative permissions save diffs
 * against this state (see protocolPermissions.listProtocolScopesToRevoke)
 * instead of revoking the registry's whole grantable universe — the sweep
 * that grew with the catalog until a save could no longer fit in a block.
 *
 * Freshness is load-bearing: a stale view under-revokes, silently keeping
 * grants an earlier save made. Every source is therefore checked against the
 * highest block a previous save was seen landing in (recorded per modifier
 * in localStorage), and a read that cannot reach that block is treated the
 * same as a failed one. Callers must fail the save closed on either.
 */

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

/** The six events that move a role's target/function grants. */
const SCOPE_EVENT_NAMES = [
  "AllowTarget",
  "ScopeTarget",
  "RevokeTarget",
  "AllowFunction",
  "ScopeFunction",
  "RevokeFunction",
] as const;

const scopeEventTopics = new Set(
  SCOPE_EVENT_NAMES.map(
    (name) => rolesInterface.getEvent(name)!.topicHash.toLowerCase(),
  ),
);

/** The raw log fields the replay needs, however the log was fetched. */
export interface IRoleScopeLog {
  topics: readonly string[];
  data: string;
  blockNumber: number;
  logIndex: number;
}

export interface ICurrentRoleScopes {
  /**
   * Every (target, selector) with a stored function grant. RevokeTarget does
   * not clear these on-chain — the modifier only drops the target clearance,
   * and a later scopeTarget would bring the stored grants back to life — so
   * the replay keeps them across RevokeTarget too, and an authoritative save
   * revokes them explicitly.
   */
  scopes: IPermissionScope[];
  /** Targets with a live clearance (wildcard-allowed or scoped). */
  targets: string[];
  /** Highest block among the modifier's permission logs; 0 when none. */
  latestBlock: number;
}

/**
 * Fold the modifier's permission logs into the role's current grants,
 * mirroring the contract's storage semantics: clearances are last-write-wins
 * per target, function grants live in their own map keyed by
 * (target, selector) and only RevokeFunction deletes them.
 */
export const reduceRoleScopeLogs = (
  logs: IRoleScopeLog[],
  roleKeyBytes: string,
): ICurrentRoleScopes => {
  const roleKeyLower = roleKeyBytes.toLowerCase();
  const sorted = [...logs].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );

  // Lowercased key → original-cased value, so callers get real addresses
  // back while matching stays case-insensitive.
  const clearances = new Map<string, string>();
  const grants = new Map<string, IPermissionScope>();
  let latestBlock = 0;

  for (const log of sorted) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (!scopeEventTopics.has(topic)) continue;
    const parsed = rolesInterface.parseLog({
      topics: [...log.topics],
      data: log.data,
    });
    if (!parsed) continue;
    // Any permission event proves how far this source has read, whichever
    // role it touches — the floor check compares against this.
    latestBlock = Math.max(latestBlock, log.blockNumber);
    if (String(parsed.args.roleKey).toLowerCase() !== roleKeyLower) continue;

    const target = String(parsed.args.targetAddress);
    const targetLower = target.toLowerCase();
    switch (parsed.name) {
      case "AllowTarget":
      case "ScopeTarget":
        clearances.set(targetLower, target);
        break;
      case "RevokeTarget":
        clearances.delete(targetLower);
        break;
      case "AllowFunction":
      case "ScopeFunction": {
        const selector = String(parsed.args.selector);
        grants.set(`${targetLower}:${selector.toLowerCase()}`, {
          target,
          selector,
        });
        break;
      }
      case "RevokeFunction": {
        const selector = String(parsed.args.selector);
        grants.delete(`${targetLower}:${selector.toLowerCase()}`);
        break;
      }
    }
  }

  return {
    scopes: [...grants.values()],
    targets: [...clearances.values()],
    latestBlock,
  };
};

/**
 * Chains where a full modifier log history is actually readable today
 * (measured 2026-09-01): Etherscan's V2 API serves Ethereum, Polygon,
 * Arbitrum and HyperEVM on the key this app ships, and some of their RPCs
 * answer an unbounded eth_getLogs.
 *
 * Base is absent because none of those hold there: every Base RPC in
 * networksMap caps the range (10 to 10,000 blocks), the free Etherscan plan
 * refuses chain 8453 outright, and the Zodiac subgraph is unallocated on
 * The Graph. Base rides on the keyless Blockscout tier alone, which was
 * 500ing when this was written — so when it is down a Base save fails
 * closed, and the error says what to add. Editing this set changes no
 * behaviour: the fetch tries every source regardless, and the set only
 * picks which explanation the error carries.
 */
const LOG_READABLE_CHAINS = new Set<string>([
  "0x1", // Ethereum
  "0x89", // Polygon
  "0xa4b1", // Arbitrum
  "0x3e7", // HyperEVM
]);

/**
 * Thrown when no source could serve a fresh view of the modifier's log.
 * Callers must abort the save with this message rather than proceeding — a
 * save built without current state cannot revoke what it does not know
 * about, which silently keeps stale grants.
 */
export class RoleScopesUnavailableError extends Error {
  constructor(chainId: ChainId, cause?: unknown) {
    super(
      "Could not read the vault's current permissions from the Roles " +
      `modifier's event log on chain ${chainId}, so the save was not ` +
      "submitted — saving without it could silently leave permissions " +
      "granted that you switched off. " +
      (LOG_READABLE_CHAINS.has(chainId)
        ? "This is usually transient; please try again in a moment."
        : "This chain has no log source configured: its public RPCs all cap " +
          "the eth_getLogs range and the Etherscan plan in use does not " +
          "cover it. Add an RPC without a range limit for this chain, or an " +
          "explorer key that covers it."),
    );
    this.name = "RoleScopesUnavailableError";
    this.cause = cause;
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The block the modifier's last permissions save from this browser landed
 * in, per (chain, modifier). A log source that has not indexed up to it yet
 * is stale by proof, not by suspicion — the explorer usually lags a save by
 * seconds, exactly the window in which a save-tweak-save sequence would
 * otherwise diff against the pre-save state and under-revoke.
 *
 * localStorage-only, so a save made from another device is not covered; the
 * residual window is that device's explorer lag. Storage being unavailable
 * degrades to floor 0 (no check), never to a failed save.
 */
const FLOOR_STORAGE_KEY = "rethink.permissionsSaveFloor";

const floorKey = (chainId: ChainId, rolesModAddress: string): string =>
  `${chainId}:${rolesModAddress.toLowerCase()}`;

const readFloorMap = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(FLOOR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const recordPermissionsSaveBlock = (
  chainId: ChainId,
  rolesModAddress: string,
  blockNumber: number,
): void => {
  if (!Number.isFinite(blockNumber) || blockNumber <= 0) return;
  try {
    const map = readFloorMap();
    const key = floorKey(chainId, rolesModAddress);
    map[key] = Math.max(Number(map[key] ?? 0), blockNumber);
    localStorage.setItem(FLOOR_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort only; the fetch degrades to an uncheckable floor.
  }
};

const readPermissionsSaveFloor = (
  chainId: ChainId,
  rolesModAddress: string,
): number => Number(readFloorMap()[floorKey(chainId, rolesModAddress)] ?? 0);

const toRoleScopeLog = (log: any): IRoleScopeLog => ({
  // Blockscout pads unused topic slots with null and the RPC omits them;
  // either way a null would stringify to "null" and break parseLog.
  topics: (log.topics ?? [])
    .filter(Boolean)
    .map((topic: unknown) => String(topic)),
  data: String(log.data ?? "0x"),
  blockNumber: Number(log.blockNumber ?? 0),
  logIndex: Number(log.logIndex ?? 0),
});

/** Refuse to page forever if an instance ignores the cursor. */
const MAX_BLOCKSCOUT_PAGES = 20;

/**
 * The modifier's logs from Blockscout, which needs no API key and covers
 * chains the app's Etherscan plan does not — Base above all, whose RPCs all
 * cap the eth_getLogs range. Public instances go down (Base's API was
 * 500ing on 2026-09-01), so this is one tier among several rather than the
 * answer; a failure here simply moves on to the next source.
 */
const fetchBlockscoutRoleLogs = async (
  chainId: ChainId,
  address: string,
): Promise<IRoleScopeLog[]> => {
  const baseUrl = BLOCKSCOUT_BASE_URLS[chainId];
  if (!baseUrl) throw new Error(`No Blockscout instance for chain ${chainId}`);

  const logs: IRoleScopeLog[] = [];
  let query = "";
  for (let page = 0; page < MAX_BLOCKSCOUT_PAGES; page++) {
    const response = await fetch(
      `${baseUrl}/api/v2/addresses/${address}/logs${query}`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Blockscout returned ${response.status} for ${address}`);
    }
    const body = await response.json();
    if (!Array.isArray(body?.items)) {
      // Shape, not status: a healthy instance always returns an items array,
      // so anything else is an answer this cannot read — next source.
      throw new TypeError("Blockscout returned no log array");
    }
    logs.push(
      ...body.items.map((item: any) =>
        toRoleScopeLog({
          topics: item.topics,
          data: item.data,
          blockNumber: item.block_number,
          logIndex: item.index,
        }),
      ),
    );
    // A truncated history is the same lie as a failed read, so page to the
    // end rather than stopping at the first screenful.
    const next = body.next_page_params;
    if (!next) return logs;
    query = `?${new URLSearchParams(next as Record<string, string>)}`;
  }
  throw new Error("Blockscout log history did not terminate");
};

/**
 * The role's current grants, from the first source that is both available
 * and fresh: the block explorer (unbounded history, but indexes a few
 * seconds behind), then each configured RPC (at head, but public ones often
 * cap the eth_getLogs range). A source that answers but has not reached the
 * recorded save floor is skipped like a failed one.
 */
export const fetchCurrentRoleScopes = async (
  chainId: ChainId,
  rolesModAddress: string,
  roleKeyBytes: string,
): Promise<ICurrentRoleScopes> => {
  const web3Store = useWeb3Store();
  const floor = readPermissionsSaveFloor(chainId, rolesModAddress);

  const sources: (() => Promise<IRoleScopeLog[]>)[] = [
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

  let lastError: unknown;
  for (const source of sources) {
    try {
      const state = reduceRoleScopeLogs(
        (await source()).map(toRoleScopeLog),
        roleKeyBytes,
      );
      if (floor > state.latestBlock) {
        lastError = new Error(
          `log source is behind the last save (floor block ${floor}, ` +
          `saw ${state.latestBlock})`,
        );
        continue;
      }
      return state;
    } catch (error) {
      lastError = error;
    }
  }
  throw new RoleScopesUnavailableError(chainId, lastError);
};
