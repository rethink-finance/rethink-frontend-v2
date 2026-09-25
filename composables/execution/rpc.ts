import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

export interface EthCallError extends Error {
  /** The revert payload, when the node returned one. */
  revertData?: string;
  /** True when a node answered — with a revert — rather than failing. */
  answered?: boolean;
}

/**
 * Account state to lay over the chain for one call (geth's eth_call third
 * argument): `{ [address]: { code, balance, nonce, state, stateDiff } }`.
 * Used to quote through a contract before it is deployed, and by tests.
 */
export type StateOverrides = Record<string, Record<string, unknown>>;

/**
 * One JSON-RPC request over the chain's configured RPCs, same fallback rule
 * the rest of the app uses: try each until one answers, and treat a revert
 * payload as the answer rather than as a dead endpoint.
 */
export const rpcRequestOn = async (
  chainId: ChainId,
  method: string,
  params: unknown[],
): Promise<any> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  let lastError: any;
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (json.error) {
        const error: EthCallError = new Error(json.error.message);
        error.revertData =
          typeof json.error.data === "string"
            ? json.error.data
            : json.error.data?.data;
        error.answered = error.revertData !== undefined;
        throw error;
      }
      if (json.result === undefined) {
        throw new TypeError("The RPC returned no result.");
      }
      return json.result;
    } catch (error: any) {
      if (error?.answered) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No RPC answered for chain ${chainId}.`);
};

/**
 * Raw eth_call, optionally from a spoofed sender (a Safe, when the question
 * is what the Safe would get) and over state overrides.
 */
export const ethCallOn = async (
  chainId: ChainId,
  to: string,
  data: string,
  from?: string,
  overrides?: StateOverrides,
): Promise<string> => {
  const result = await rpcRequestOn(chainId, "eth_call", [
    { to, data, ...(from ? { from } : {}) },
    "latest",
    ...(overrides ? [overrides] : []),
  ]);
  if (typeof result !== "string") throw new TypeError("The RPC returned no result.");
  return result;
};
