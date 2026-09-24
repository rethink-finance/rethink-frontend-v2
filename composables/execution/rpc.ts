import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

export interface EthCallError extends Error {
  /** The revert payload, when the node returned one. */
  revertData?: string;
  /** True when a node answered — with a revert — rather than failing. */
  answered?: boolean;
}

/**
 * Raw eth_call over the chain's configured RPCs, same fallback rule the rest
 * of the app uses: try each until one answers, and treat a revert payload as
 * the answer rather than as a dead endpoint.
 */
export const ethCallOn = async (
  chainId: ChainId,
  to: string,
  data: string,
  /** Spoofed sender — a Safe, when the question is what the Safe would get. */
  from?: string,
): Promise<string> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  let lastError: any;
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data, ...(from ? { from } : {}) }, "latest"],
        }),
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
      if (typeof json.result !== "string") {
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
