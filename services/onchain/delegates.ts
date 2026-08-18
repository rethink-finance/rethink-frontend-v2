import { Web3 } from "web3";
import { fetchExplorerLogs } from "./explorerLogs";
import { ERC20Votes } from "~/assets/contracts/ERC20Votes";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";
import type ISubgraphFetchDelegatesResponse from "~/types/responses/subgraph_fetch_delegates";

// keccak256("DelegateChanged(address,address,address)")
const DELEGATE_CHANGED_TOPIC =
  "0x3134e8a2e6d97e929a7e54011ea5485d7d196dd5f0ba4d4ef95803e8e3fc257f";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Thrown when no configured RPC could serve the full DelegateChanged history.
 *
 * The caller is expected to surface this as "we could not load delegates"
 * rather than as "this vault has no delegates" — the two look identical
 * otherwise, which is the bug this fallback exists to fix.
 */
export class DelegatesUnavailableError extends Error {
  constructor(chainId: ChainId, cause?: unknown) {
    super(
      `No RPC for chain ${chainId} could return the full DelegateChanged log range. ` +
      "On-chain delegate discovery needs an unbounded eth_getLogs; the configured " +
      "public RPCs cap the range. Add an RPC without a block-range limit for this chain.",
    );
    this.name = "DelegatesUnavailableError";
    this.cause = cause;
  }
}

const topicToAddress = (topic: string): string =>
  Web3.utils.toChecksumAddress("0x" + topic.slice(-40));

/**
 * Pull every DelegateChanged log the governance token has ever emitted.
 *
 * There is no cheap way to bound this range: the token's deployment block is
 * only reachable through archive state (the public RPCs prune it), and chunked
 * scanning is hopeless at these chain heights — Arbitrum alone is ~490M blocks,
 * so a 10k-block cap would mean ~49k requests. So we ask the block explorer
 * first, which serves the whole history unbounded, and fall back to asking each
 * configured RPC for the full range and taking the first that obliges. As of
 * 2026-08-10 that is `arb1.arbitrum.io/rpc` on Arbitrum and
 * `polygon.gateway.tenderly.co` on Polygon; on HyperEVM every RPC caps the
 * range, so the explorer is the only path that answers there.
 */
const fetchDelegateChangedLogs = async (
  chainId: ChainId,
  votingContract: string,
): Promise<any[]> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  let lastError: unknown;

  try {
    return await fetchExplorerLogs(chainId, votingContract, DELEGATE_CHANGED_TOPIC);
  } catch (error: any) {
    console.debug(
      "Explorer log history unavailable, falling back to RPC:",
      error?.message ?? error,
    );
    lastError = error;
  }

  for (const rpcUrl of rpcUrls) {
    try {
      const web3 = new Web3(rpcUrl);
      return await Promise.race([
        web3.eth.getPastLogs({
          address: votingContract,
          topics: [DELEGATE_CHANGED_TOPIC],
          fromBlock: 0,
          toBlock: "latest",
        }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error(`getPastLogs timed out on ${rpcUrl}`)), 20000),
        ),
      ]) as any[];
    } catch (error: any) {
      // Range caps, pruned nodes and dead endpoints all land here. None of them
      // are worth retrying on the same URL, so move straight to the next RPC.
      console.debug(`getPastLogs unavailable on ${rpcUrl}:`, error?.message ?? error);
      lastError = error;
    }
  }

  throw new DelegatesUnavailableError(chainId, lastError);
};

/**
 * Reconstruct the current delegation graph straight from the governance token.
 *
 * Returns the same shape the delegates subgraph query does, so the existing
 * mapper formats both sources identically.
 */
export const fetchOnChainDelegates = async (
  chainId: ChainId,
  votingContract: string,
): Promise<ISubgraphFetchDelegatesResponse> => {
  const web3Store = useWeb3Store();
  const logs = await fetchDelegateChangedLogs(chainId, votingContract);

  // Last write wins: a wallet's current delegate is whatever its most recent
  // DelegateChanged says. getPastLogs returns ascending block order, but not
  // every RPC guarantees log order within a block, so sort explicitly.
  const orderedLogs = [...logs].sort((a, b) => {
    const blockDiff = Number(a.blockNumber ?? 0) - Number(b.blockNumber ?? 0);
    return blockDiff !== 0 ? blockDiff : Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0);
  });

  const delegatorToDelegate = new Map<string, string>();
  for (const log of orderedLogs) {
    const topics = log?.topics;
    if (!topics || topics.length < 4) continue;
    delegatorToDelegate.set(topicToAddress(topics[1]), topicToAddress(topics[3]));
  }

  const tokenContract = web3Store.getCustomContract(
    chainId,
    ERC20Votes.abi,
    votingContract,
  );

  const delegateAddresses = [
    ...new Set(
      [...delegatorToDelegate.values()].filter((address) => address !== ZERO_ADDRESS),
    ),
  ];
  const delegatorAddresses = [...delegatorToDelegate.keys()];

  const [totalWeight, delegateVotes, delegatorBalances] = await Promise.all([
    web3Store.callWithRetry(chainId, () =>
      tokenContract.methods.totalSupply().call(),
    ),
    Promise.all(
      delegateAddresses.map((address) =>
        web3Store.callWithRetry(chainId, () =>
          tokenContract.methods.getVotes(address).call(),
        ),
      ),
    ),
    Promise.all(
      delegatorAddresses.map((address) =>
        web3Store.callWithRetry(chainId, () =>
          tokenContract.methods.balanceOf(address).call(),
        ),
      ),
    ),
  ]);

  const votesByDelegate = new Map(
    delegateAddresses.map((address, index) => [
      address,
      (delegateVotes[index] ?? 0n).toString(),
    ]),
  );
  const balanceByDelegator = new Map(
    delegatorAddresses.map((address, index) => [
      address,
      (delegatorBalances[index] ?? 0n).toString(),
    ]),
  );

  const delegatorsByDelegate = new Map<string, string[]>();
  for (const [delegator, delegate] of delegatorToDelegate) {
    if (delegate === ZERO_ADDRESS) continue;
    delegatorsByDelegate.set(delegate, [
      ...(delegatorsByDelegate.get(delegate) ?? []),
      delegator,
    ]);
  }

  return {
    id: votingContract,
    totalWeight: { value: totalWeight?.toString() ?? "0" },
    // The subgraph query filters on `value_gt: 0`; mirror that so wallets that
    // delegated and then fully redeemed do not linger as zero-power rows.
    weight: delegateAddresses
      .filter((address) => BigInt(votesByDelegate.get(address) ?? "0") > 0n)
      .map((address) => ({
        value: votesByDelegate.get(address) ?? "0",
        account: {
          id: address,
          delegationFrom: (delegatorsByDelegate.get(address) ?? []).map((delegator) => ({
            delegator: {
              id: delegator,
              voteWeigth: [{ value: balanceByDelegator.get(delegator) ?? "0" }],
            },
          })),
        },
      })),
  };
};
