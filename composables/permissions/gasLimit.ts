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
 *
 * Base enforces the same cap, read off the chain rather than a changelog:
 * across 103,000 Base transactions on 2026-09-21 the largest limit was
 * exactly 2^24, fourteen sat on it and none above, and its estimator refuses
 * a call that needs more however high a limit it is offered. That is what
 * stranded the INDEFI vault — its NAV update had been mined at 17.8M gas
 * until April and could not be mined at all afterwards.
 *
 * Keyed by hex chain id to stay import-free.
 */
export const TX_GAS_CAPS: Record<string, number> = {
  "0x1": 16_777_216,
  "0x2105": 16_777_216,
};

/** "17.8M" — a gas figure for reading, not for arithmetic. */
export const formatGas = (gas: number): string =>
  gas >= 1_000_000
    ? `${(gas / 1_000_000).toFixed(1)}M`
    : Math.round(gas).toLocaleString("en-US");

/**
 * The call needs more gas than the chain lets one transaction carry. No
 * wallet, gas setting or frontend can mine it; only a lighter call can. It is
 * thrown before the wallet opens, because what the wallet shows instead is
 * worse than nothing: its own estimate fails, it falls back to a share of the
 * block (140M on Base) and quotes a fee for a transaction it cannot send.
 */
export class TransactionGasCapError extends Error {
  readonly cap: number;
  /** Measured by dry runs; undefined when even the search ceiling failed. */
  readonly required?: number;

  constructor(cap: number, required: number | undefined, chainName: string) {
    super(
      `This transaction needs ${
        required ? `about ${formatGas(required)}` : `more than ${formatGas(cap)}`
      } gas, and ${chainName} allows at most ${formatGas(cap)} in a single ` +
        "transaction. It cannot be mined as it is, from any wallet.",
    );
    this.name = "TransactionGasCapError";
    this.cap = cap;
    this.required = required;
  }
}

/**
 * Narrow down what a call needs, given a probe that says whether it succeeds
 * at a limit. The caller has established that it fails at `cap` and succeeds
 * with no limit at all; this looks between the cap and four times it, which
 * is as far as a figure is worth having. A few probes are enough — the answer
 * is for a sentence, and each probe is a full dry run of a heavy call.
 */
export const bracketRequiredGas = async (
  cap: number,
  succeedsAt: (gas: number) => Promise<boolean>,
  probes = 5,
): Promise<number | undefined> => {
  let low = cap;
  let high = cap * 4;
  if (!(await succeedsAt(high))) return undefined;
  for (let i = 0; i < probes; i++) {
    const middle = Math.floor((low + high) / 2);
    if (await succeedsAt(middle)) high = middle;
    else low = middle;
  }
  return high;
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
