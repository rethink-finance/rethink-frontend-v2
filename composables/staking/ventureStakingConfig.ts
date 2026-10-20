import { ChainId } from "~/types/enums/chain_id";

export interface VentureTier {
  name: string;
  /** ETH this tier holds; the last tier is open-ended. */
  capacityEth: number;
  baseMultiplier: number;
}

/**
 * Venture staking program constants. The calculator, the stake card and
 * (later) the staking flow all read these; nothing else should hard-code them.
 */
export const VENTURE_STAKING = {
  supply: 100_000_000,
  stakerAllocationShare: 0.2,
  emissionMonths: 72,
  monthlyDecay: 0.035,
  /** Filled in order of total ETH deposited. */
  tiers: [
    { name: "Founding", capacityEth: 2_000, baseMultiplier: 3 },
    { name: "Second", capacityEth: 3_000, baseMultiplier: 2 },
    { name: "Third", capacityEth: 5_000, baseMultiplier: 1.5 },
    { name: "Open", capacityEth: Infinity, baseMultiplier: 1 },
  ] as VentureTier[],
  /** Share of a tier's bonus (multiplier - 1) left after each 12-month step. */
  multiplierFade: [1, 0.5, 0.25, 0],
  /** Pool assumed while the vault reads empty (pre-launch); includes the visitor. */
  assumedLaunchPoolEth: 2_000,
  // TODO: read from the app's price feed once the page goes live.
  ethPriceUsd: 3_000,
  stakingYield: 0.03,
  horizonMonths: 12,
  fdvScenarios: [
    { fdvMillions: 25, label: "Cautious" },
    { fdvMillions: 40, label: "Base" },
    { fdvMillions: 100, label: "Upside" },
  ],
  defaultFdvMillions: 40,
  defaultEth: 10,
} as const;

/**
 * Where the live pool size comes from. `address` is empty until the venture
 * staking vault is deployed; the calculator then falls back to the assumed
 * launch pool.
 */
export const VENTURE_STAKING_VAULT = {
  chainId: ChainId.ETHEREUM,
  // TODO: set once the venture staking vault is deployed.
  address: "",
  /** Returns the ETH staked in the vault, in wei. */
  method: "totalAssets",
  abi: [
    {
      inputs: [],
      name: "totalAssets",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ],
  decimals: 18,
} as const;

export const VENTURE_STAKING_TERMS_URL = "https://docs.rethink.finance/rethink.finance";
