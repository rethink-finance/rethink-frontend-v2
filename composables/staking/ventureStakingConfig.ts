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
  yieldGeneratedEth: 4.6,
  refiDistributed: 1_123_400,
  stakers: 214,
  position: {
    symbol: "ETH" as const,
    amount: 12,
    yieldRedirected: 0.044,
    refiEarned: 10_842.37,
  },
};
