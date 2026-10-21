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
  /** Yearly yield there, a snapshot as of VENTURE_YIELD_RATES_AS_OF. */
  apy: number;
}

/** Where an asset's yield comes from. Shown on the staking page. */
export interface VentureYieldStrategy {
  label: string;
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
    { name: "Seed", capacityUsd: 9_000_000, baseMultiplier: 2 },
    { name: "Growth", capacityUsd: 15_000_000, baseMultiplier: 1.5 },
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
/** When the venue yields below were read (DefiLlama, Ethereum mainnet). */
export const VENTURE_YIELD_RATES_AS_OF = "2026-10-21";

/**
 * The yield strategy per asset: the deepest blue-chip venues only, no
 * leverage, no bridges, no restaking, and no protocol holding more than 40%
 * of an asset.
 * TODO: confirm with the strategy owner before launch; re-read the rates.
 */
export const VENTURE_STAKING_YIELD_STRATEGIES: Record<VentureAsset["symbol"], VentureYieldStrategy> = {
  ETH: {
    label: "Liquid staking",
    sources: [
      // The deepest liquid staking token; held at 40% to spread operator risk.
      { name: "Lido", logo: "lido", position: "stETH", weight: 0.4, apy: 0.0223 },
      // A regulated operator on a different validator set.
      { name: "Coinbase", logo: "coinbase-wrapped-staked-eth", position: "cbETH", weight: 0.35, apy: 0.0229 },
      // No protocol fee; estimated from Lido's gross rate before its 10% cut.
      { name: "Own validators", position: "Native ETH", weight: 0.25, apy: 0.0245 },
    ],
  },
  WBTC: {
    // BTC lending pays almost nothing (few borrow BTC). Liquidity in pegged
    // WBTC/cbBTC pools earns swap fees with no price risk between two BTCs,
    // at the cost of holding part of the position as Coinbase's cbBTC.
    // Capacity is the limit: the fees are set by volume, so the rate falls as
    // the deposit grows past a few million dollars.
    label: "Pegged BTC liquidity",
    sources: [
      // 0.01% fee tier, kept in a tight range around the peg; the best rate.
      { name: "Uniswap v3", logo: "uniswap-v3", position: "WBTC/cbBTC LP", weight: 0.5, apy: 0.0136 },
      // The deepest pegged BTC pool by volume; no range to manage.
      { name: "Fluid", logo: "fluid", position: "WBTC/cbBTC LP", weight: 0.5, apy: 0.0052 },
    ],
  },
  USDC: {
    label: "Money market",
    sources: [
      // Sky's savings rate, backed by T-bills and over-collateralised loans; instant exit.
      { name: "Spark Savings", logo: "spark-savings", position: "sUSDC", weight: 0.35, apy: 0.038 },
      // The deepest USDC lending market; the liquid slice.
      { name: "Aave v3", logo: "aave-v3", position: "aEthUSDC", weight: 0.25, apy: 0.0379 },
      // Steakhouse's curated vault: only blue-chip collateral.
      { name: "Morpho", logo: "morpho-blue", position: "steakUSDC", weight: 0.25, apy: 0.0447 },
      // The highest blue-chip rate; held smallest as the youngest venue.
      { name: "Fluid", logo: "fluid", position: "fUSDC", weight: 0.15, apy: 0.0564 },
    ],
  },
};

/** An asset's yield across its venues, weighted by allocation. */
export const blendedApy = (symbol: VentureAsset["symbol"]) =>
  VENTURE_STAKING_YIELD_STRATEGIES[symbol].sources.reduce((sum, source) => sum + source.weight * source.apy, 0);

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
 * Buybacks: 100% of the revenue Rethink Finance earns buys back REFI.
 * Revenue has three sources; the two marked "assumed" are estimates.
 * TODO: confirm the manager-fee and referral assumptions and the starting AUM.
 */
export const VENTURE_BUYBACKS = {
  revenue: {
    /** Platform fee on AUM. */
    platformFeeBps: 15,
    /** Assumed: what managers earn a year (management plus performance), on AUM. */
    managerEarningsBps: 150,
    /** Rethink's cut of what managers earn. */
    managerShare: 0.05,
    /** Assumed: referral fees from the venues vaults route through, on AUM. */
    referralBps: 3,
  },
  aumMinUsd: 10_000_000,
  aumMaxUsd: 2_000_000_000,
  defaultAumUsd: 250_000_000,
  growthMax: 2,
  defaultGrowth: 0.75,
  /** Years projected; the program emits over six. */
  years: 6,
} as const;

export type VentureRevenueModel = typeof VENTURE_BUYBACKS.revenue;
