/**
 * Choosing the gas limit for a curator transaction.
 *
 * The app used to leave this to the wallet, and wallets get it badly wrong
 * for exactly the calls curators make. A NAV update costs millions of gas
 * (2.4M on the HyperEVM vault, 22M on the largest Polygon one), and on
 * HyperEVM it reads the HyperCore precompiles, which a wallet's own estimator
 * cannot model: a manager's Update NAV went out with 437,310 gas against a
 * requirement of 2,383,131 and died inside the Safe as an out-of-gas that the
 * Roles modifier reports as ModuleTransactionFailed. The app's RPCs are vetted
 * to execute those precompiles, so the app asks them and says what it needs.
 *
 * Kept free of store imports so the arithmetic can be unit-tested on its own;
 * composables/permissions/useRoleExecution.ts feeds it.
 */

/**
 * Headroom over the estimate. eth_estimateGas already accounts for the 63/64
 * rule — it searches for the limit that makes the whole call succeed — so
 * this only has to cover state moving between the estimate and the block: a
 * flow request arriving before a settlement, a position opening or closing.
 *
 * That movement is large. The same Arbitrum vault's NAV update used 2.6M gas
 * one day and 6.3M the next, and 6% more on a second run four minutes after
 * the first — while the manager's wallet had taken to sending limits about 2%
 * over what the call needed, which MetaMask's Smart Transactions then drops
 * as "cancelled" rather than mine a revert. 1.5x is the long-standing wallet
 * default; unused gas is refunded, so the only cost is the balance the wallet
 * asks the sender to hold, and it also covers the overhead of a wallet that
 * wraps the call (MetaMask's delegation wrapper on smart accounts).
 */
export const GAS_BUFFER = 1.5;

/**
 * The share of a block a single transaction may ask for. A limit at the full
 * block size only fits an empty block; leaving a sliver lets it share one.
 */
export const BLOCK_SHARE = 0.95;

/**
 * Per-transaction ceilings that sit below the block limit. Ethereum caps a
 * single transaction at 2^24 gas since Fusaka (EIP-7825); a limit above it
 * is not merely unmineable, it is invalid and the wallet cannot broadcast it.
 * Base adopted the same cap on 2026-05-28 (found by bisecting eth_estimateGas
 * at historical blocks: the INDEFI NAV update, 17.8M gas, has been unmineable
 * there since). Keyed by hex chain id to stay import-free.
 */
export const TX_GAS_CAPS: Record<string, number> = {
  "0x1": 16_777_216,
  "0x2105": 16_777_216,
};

export interface IGasPlan {
  /** The limit to put on the transaction. */
  gas: number;
  /**
   * The call needs more than a standard block can give it. On HyperEVM that
   * means the sender must have big blocks enabled (30M instead of 3M); the
   * limit is still returned, because with big blocks on it is the right one.
   */
  exceedsBlockLimit: boolean;
}

/**
 * @param required      what eth_estimateGas says the call needs to succeed
 * @param blockGasLimit the chain's standard block gas limit, when known
 * @param txGasCap      a per-transaction ceiling, when the chain has one
 */
export const planGasLimit = (
  required: number,
  blockGasLimit?: number,
  txGasCap?: number,
): IGasPlan => {
  const buffered = Math.ceil(required * GAS_BUFFER);
  const ceiling = Math.min(
    blockGasLimit ? Math.floor(blockGasLimit * BLOCK_SHARE) : Infinity,
    txGasCap ?? Infinity,
  );

  if (buffered <= ceiling) return { gas: buffered, exceedsBlockLimit: false };
  // The headroom does not fit but the call itself does: take everything the
  // block allows. This is the HyperEVM NAV update — 2.38M needed, 2.85M given.
  if (required <= ceiling) return { gas: ceiling, exceedsBlockLimit: false };
  return { gas: buffered, exceedsBlockLimit: true };
};
