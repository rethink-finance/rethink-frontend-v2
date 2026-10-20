import { ChainId } from "~/types/enums/chain_id";

export interface VentureAsset {
  symbol: "ETH" | "WBTC" | "USDC";
  /** USD per unit. ETH reads the program's ethPriceUsd. */
  priceUsd: number;
  /** Yearly yield the deposit would otherwise earn; this is what gets redirected. */
  yieldRate: number;
  /** How the forgone yield is named in copy ("staking yield"). */
  yieldLabel: string;
  defaultAmount: number;
  min: number;
  step: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  /** Fraction digits worth showing for an amount of this asset. */
  displayDecimals: number;
}

export interface VentureYieldSource {
  name: string;
  /** DefiLlama protocol slug for the logo; none draws a generic mark. */
  logo?: string;
  /** The position token the deposit becomes there. */
  position: string;
  /** Share of the asset placed here, 0..1; an asset's sources sum to 1. */
  weight: number;
}

/** Where an asset's yield comes from. Shown on the staking page. */
export interface VentureYieldStrategy {
  label: string;
  summary: string;
  sources: VentureYieldSource[];
}

export interface VentureTier {
  name: string;
  /**
   * USD this tier holds, counted at deposit-time prices so the count only
   * moves forward. The last tier is open-ended.
   */
  capacityUsd: number;
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
    // The spec's 2,000 / 3,000 / 5,000 ETH at its $3,000 ETH.
    { name: "Founding", capacityUsd: 6_000_000, baseMultiplier: 3 },
    { name: "Second", capacityUsd: 9_000_000, baseMultiplier: 2 },
    { name: "Third", capacityUsd: 15_000_000, baseMultiplier: 1.5 },
    { name: "Open", capacityUsd: Infinity, baseMultiplier: 1 },
  ] as VentureTier[],
  /** Share of a tier's bonus (multiplier - 1) left after each 12-month step. */
  multiplierFade: [1, 0.5, 0.25, 0],
  /** Pool assumed while the vault reads empty (pre-launch); includes the visitor. */
  assumedLaunchPoolUsd: 6_000_000,
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
 * Assets the calculator accepts. Non-ETH deposits count toward the
 * ETH-denominated tiers at their USD value. The ranges keep each slider near
 * the ETH one's 1 to 200 ETH.
 */
export const VENTURE_STAKING_ASSETS: VentureAsset[] = [
  {
    symbol: "ETH",
    priceUsd: VENTURE_STAKING.ethPriceUsd,
    yieldRate: VENTURE_STAKING.stakingYield,
    yieldLabel: "staking yield",
    defaultAmount: VENTURE_STAKING.defaultEth,
    min: 0.1,
    step: 0.1,
    sliderMin: 1,
    sliderMax: 200,
    sliderStep: 1,
    displayDecimals: 3,
  },
  {
    symbol: "WBTC",
    // TODO: placeholder price and yield; confirm with the program terms.
    priceUsd: 100_000,
    yieldRate: 0.01,
    yieldLabel: "yield",
    defaultAmount: 0.3,
    min: 0.001,
    step: 0.01,
    sliderMin: 0.03,
    sliderMax: 6,
    sliderStep: 0.01,
    displayDecimals: 4,
  },
  {
    symbol: "USDC",
    // TODO: placeholder yield; confirm with the program terms.
    priceUsd: 1,
    yieldRate: 0.05,
    yieldLabel: "yield",
    defaultAmount: 30_000,
    min: 100,
    step: 100,
    sliderMin: 3_000,
    sliderMax: 600_000,
    sliderStep: 1_000,
    displayDecimals: 0,
  },
];

/**
 * Where the live pool size comes from. `address` is empty until the venture
 * staking vault is deployed; the calculator then falls back to the assumed
 * launch pool.
 */
/**
 * The yield strategy per asset: the most conservative source for each, no
 * leverage, no bridges, no restaking.
 * TODO: confirm venues and weights with the strategy owner before launch.
 */
export const VENTURE_STAKING_YIELD_STRATEGIES: Record<VentureAsset["symbol"], VentureYieldStrategy> = {
  // TODO: the weights are illustrative; set them from the live allocation.
  ETH: {
    label: "Liquid staking",
    summary: "Staked with Ethereum validators through the most established liquid staking providers.",
    sources: [
      { name: "Lido", logo: "lido", position: "stETH", weight: 0.4 },
      { name: "Rocket Pool", logo: "rocket-pool", position: "rETH", weight: 0.25 },
      { name: "Coinbase", logo: "coinbase-wrapped-staked-eth", position: "cbETH", weight: 0.2 },
      { name: "Own validators", position: "Native ETH", weight: 0.15 },
    ],
  },
  WBTC: {
    label: "Blue-chip lending",
    summary: "Lent on the deepest over-collateralized markets. No bridges, no restaking.",
    sources: [
      { name: "Aave v3", logo: "aave-v3", position: "aEthWBTC", weight: 0.6 },
      { name: "SparkLend", logo: "sparklend", position: "spWBTC", weight: 0.4 },
    ],
  },
  USDC: {
    label: "Money market",
    summary: "Spread across the safest stablecoin savings and lending vaults.",
    sources: [
      { name: "Spark Savings", logo: "spark-savings", position: "sUSDC", weight: 0.35 },
      { name: "Aave v3", logo: "aave-v3", position: "aEthUSDC", weight: 0.3 },
      { name: "Morpho", logo: "morpho-blue", position: "steakUSDC", weight: 0.2 },
      { name: "Compound v3", logo: "compound-v3", position: "cUSDCv3", weight: 0.15 },
    ],
  },
};

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

/**
 * Sample figures the page shows while the vault is not deployed, so the
 * design can be judged with numbers in it. Flagged as preview data in the UI
 * and dropped automatically once VENTURE_STAKING_VAULT.address is set.
 */
export const VENTURE_STAKING_PREVIEW = {
  /** Days since launch, which places the emission curve's marker. */
  daysLive: 45,
  holdings: { ETH: 1_050, WBTC: 3.1, USDC: 261_000 },
  /** All assets' yield reinvested so far, at the price on the day it came in. */
  yieldGeneratedUsd: 16_400,
  refiDistributed: 1_123_400,
  stakers: 214,
  position: {
    symbol: "ETH" as const,
    amount: 12,
    yieldRedirected: 0.044,
    refiEarned: 10_842.37,
  },
};

/**
 * Buybacks: 100% of the revenue Rethink Finance earns buys back REFI. The
 * simulator's ranges and defaults live here.
 * TODO: confirm the fee rate and the starting AUM.
 */
export const VENTURE_BUYBACKS = {
  feeOptionsBps: [10, 15, 25],
  defaultFeeBps: 15,
  aumMinUsd: 10_000_000,
  aumMaxUsd: 5_000_000_000,
  defaultAumUsd: 250_000_000,
  /** Program years whose emissions the chart compares buybacks against. */
  emissionYears: [1, 3],
} as const;
