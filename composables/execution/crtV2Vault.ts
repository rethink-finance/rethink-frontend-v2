import { ethers } from "ethers";

/**
 * The CarrotFunding Vault on HyperEVM, second deployment (Roles v2, V1.5
 * factory), as the chain has it. Deployed 2026-10-05 in
 * 0x72f4ed326b4e39d17dba5c3443210c8a892f44c5553ff7dc3c3469139ce7cd65 by the
 * executor key; every address below was read back off that receipt and the
 * modifier's own event log, not copied from a plan.
 *
 * Shared by the raw-permission generator (crtV2Permissions.ts), the console
 * (crtV2Console.ts) and their tests, so the whitelist and the calls made
 * against it can never disagree about an address.
 */
export const CRT_V2_ADDR = {
  /** GovernableFund proxy. Uninitialised until finalizeCreateFund. */
  fund: "0xeD8f7E3ED5c37D508e8E4725d6970356B8FecE2A",
  /** The custody Safe (avatar and target of the modifier). Owner: the governor. */
  safe: "0xb25666BC66630ad02e12E680BAe053b85389D5E9",
  /** Zodiac Roles v2.1.1 behind the factory's beacon. */
  roles: "0x5Eb928db6224f41B421E050A3689F66B0698AB8E",
  governor: "0xa0479fA56bedBFBA8D7192a8AA293a2FF97ee73d",
  /** GovernableFundFactory V1.5 — owns the modifier until the vault is finalized. */
  factory: "0x8Ac19ed0280c3ea1A89C6209ACA862Db0Cb5Ffa8",
  /** Role 2, the executor: the manager EOA that also deployed the vault. */
  executor: "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054",
  /** Role 1, the admin: the Carrot 2-of-4 Safe (the v1 vault's payout Safe). */
  adminSafe: "0xAda3dF31614438Ec8C96470148D52Ce30A037071",
  /**
   * The only address a payout may land on, on HyperEVM (USDC.transfer) and on
   * Arbitrum (Across depositV3Now recipient). Also the trading bot's HyperCore
   * agent key. Carried over from the v1 vault's governance proposal of
   * 2026-09-26.
   */
  payout: "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571",
  usdc: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
  /** HyperCore system contract: raw actions for the calling address. */
  coreWriter: "0x3333333333333333333333333333333333333333",
  /** CoreDepositWallet: USDC from the EVM into the Safe's HyperCore account. */
  cdw: "0x6b9e773128f453f5c2c60935ee2de2cbc5390a24",
  /** The USDC system address on HyperCore: a spot send here credits the EVM. */
  coreBridge: "0x2000000000000000000000000000000000000000",
  /** Felix feUSDC (MetaMorpho v1.1, ERC-4626). */
  felix: "0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27",
  /** HyperLend pool (Aave v3 fork). */
  pool: "0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b",
  /** HyperLend hUSDC aToken. */
  hToken: "0x744e4f26ee30213989216e1632d9be3547c4885b",
  /** Across SpokePool on HyperEVM (ERC1967 proxy). */
  spokePool: "0x35E63eA3eb0fb7A3bc543C71FB66412e1F6B0E04",
  /** Safe's canonical MultiSendCallOnly 1.3.0; the admin Safe batches with it. */
  multiSendCallOnly: "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
  /** Native USDC on Arbitrum, what the payout wallet receives there. */
  arbUsdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  /** HyperEVM's NAV executor (the same one the v1 vault's whitelist names). */
  navExecutor: "0x49a2ec2de6cbdb3282c5bdec3b6ceb0157d84a47",
  /** PoolPerformanceFeeBeaconProxy on HyperEVM. */
  poolPerformanceFee: "0xa290641ecce7c0d7835ca128810b240f74a399be",
} as const;

export const CRT_V2_CHAIN_ID = 999;
export const CRT_V2_CHAIN_HEX = "0x3e7";
export const ARBITRUM_CHAIN_ID = 42161;

/**
 * The modifier's two role keys. The executor's is the factory's own
 * (`initCreateFund` assigns the deployer to it); this vault came out of the
 * factory under the correctly spelt "defaultManagerRole", not the misspelt
 * "defaulManagerRole" older vaults carry — read back from the AssignRoles
 * event in the deploy receipt.
 */
export const CRT_V2_ROLE_KEYS = {
  admin: ethers.encodeBytes32String("adminRole"),
  executor: ethers.encodeBytes32String("defaultManagerRole"),
} as const;

export type CrtV2Role = keyof typeof CRT_V2_ROLE_KEYS;

const coder = ethers.AbiCoder.defaultAbiCoder();

/**
 * HyperCore raw actions, as CoreWriter.sendRawAction takes them: one version
 * byte (0x01), three bytes of action id, then the ABI-encoded fields.
 * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore
 */
export const HYPERCORE_ACTION = {
  usdClassTransfer: 7,
  addApiWallet: 9,
  sendAsset: 13,
} as const;

export const hypercoreHeader = (actionId: number): string =>
  "0x01" + actionId.toString(16).padStart(6, "0");

/** Perp ↔ spot USDC move inside the Safe's HyperCore account. `ntl` is USDC in 1e6. */
export const encodeUsdClassTransfer = (ntl: bigint, toPerp: boolean): string =>
  hypercoreHeader(HYPERCORE_ACTION.usdClassTransfer) +
  coder.encode(["uint64", "bool"], [ntl, toPerp]).slice(2);

/**
 * sendAsset(destination, subAccount, sourceDex, destinationDex, token, wei).
 * Core → EVM for USDC is destination = the USDC system address, both dexes
 * spot (0xffffffff), token 0, wei in 1e8.
 */
export const encodeSendAsset = (
  destination: string,
  subAccount: string,
  sourceDex: number,
  destinationDex: number,
  token: bigint,
  wei: bigint,
): string =>
  hypercoreHeader(HYPERCORE_ACTION.sendAsset) +
  coder
    .encode(
      ["address", "address", "uint32", "uint32", "uint64", "uint64"],
      [destination, subAccount, sourceDex, destinationDex, token, wei],
    )
    .slice(2);

export const SPOT_DEX = 0xffffffff;
export const USDC_CORE_TOKEN = 0n;

/** The Safe's USDC from Core spot to its own HyperEVM balance. */
export const encodeSendUsdcToEvm = (wei: bigint): string =>
  encodeSendAsset(CRT_V2_ADDR.coreBridge, ethers.ZeroAddress, SPOT_DEX, SPOT_DEX, USDC_CORE_TOKEN, wei);

/**
 * addApiWallet(agent, name). HyperCore reads an expiry out of the name,
 * "<name> valid_until <unix ms>"; the zero address empties the slot that
 * name holds.
 */
export const encodeAddApiWallet = (agent: string, name: string): string =>
  hypercoreHeader(HYPERCORE_ACTION.addApiWallet) +
  coder.encode(["address", "string"], [agent, name]).slice(2);

/**
 * How far into a sendAsset payload the fields that must not move reach: the
 * 4-byte header and the first five words (destination, subAccount, both
 * dexes, token). Only the sixth word, the amount, is the executor's to set.
 */
export const SEND_ASSET_PINNED_BYTES = 4 + 5 * 32;

/** The agent name HyperCore stores for the trading bot's key, before its expiry suffix. */
export const CRT_V2_AGENT_NAME = "carrot";
/** HyperCore's bounds on a named agent's validity, in days. */
export const CRT_V2_AGENT_MIN_DAYS = 14;
export const CRT_V2_AGENT_MAX_DAYS = 180;

/**
 * Across payouts go out in these deposit sizes only (USDC), largest first
 * when an amount is split. Across keeps `inputAmount − outputAmount` for the
 * relayer that fills, and Roles v2 cannot compare two parameters, so a free
 * amount pair would let whoever holds the admin role set outputAmount to
 * zero and have a relayer of its choosing keep the deposit. Fixing the
 * input to a known size is what lets each one carry a fixed floor on its
 * output.
 *
 * Nine sizes because every size costs about 190k gas to store: nine keep
 * the scope near 2.1M gas, so a Permissions-step save that carries it (plus
 * the step's own switches, ~0.5M) still fits a standard 3M HyperEVM block
 * without big blocks. What is left below 100 USDC is paid on HyperEVM.
 */
export const ACROSS_TRANCHES_USDC = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

/**
 * The most one deposit of `inputAmount` (USDC in 1e6) may leave to its
 * relayer: 0.25 USDC + 0.05 %. Across charged about 0.01 USDC + 0.01 % on
 * this route on 2026-10-05, so this is five times that with a floor; a
 * deposit whose fee outgrows it is simply not filled and comes back to the
 * vault Safe after its fill deadline.
 */
export const acrossMaxRelayerShare = (inputAmount: bigint): bigint => 250000n + (inputAmount * 5n) / 10000n;
/** The smallest outputAmount the whitelist accepts for a deposit of `inputAmount`. */
export const acrossMinOutput = (inputAmount: bigint): bigint => inputAmount - acrossMaxRelayerShare(inputAmount);

/** `amount` (USDC in 1e6) as tranche deposits, largest first, and what is left below the smallest. */
export const splitIntoAcrossTranches = (amount: bigint): { tranches: bigint[]; remainder: bigint } => {
  const tranches: bigint[] = [];
  let left = amount;
  for (const usdc of ACROSS_TRANCHES_USDC) {
    const size = BigInt(usdc) * 1000000n;
    while (left >= size) {
      tranches.push(size);
      left -= size;
    }
  }
  return { tranches, remainder: left };
};
