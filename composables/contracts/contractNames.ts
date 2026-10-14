/**
 * Human names for contract addresses, shared by every view that shows one:
 * the vault's permissions, the create flow's saved permissions, the rule
 * editor and proposals. In order of preference a contract is called by
 *
 *   1. a hand-written name, for the contracts vaults keep using (below),
 *   2. its own token name and symbol, when it is a token,
 *   3. the explorer's verified contract name, read through any proxy and
 *      split into words,
 *
 * and only then by its address. A proxy's own contract name ("ERC1967Proxy",
 * "AdminUpgradableProxy") says nothing about what the contract does, so it
 * is never used.
 *
 * This module imports nothing, so stores and composables can both use it.
 */

/** HyperCore's write precompile on HyperEVM. */
export const CORE_WRITER = "0x3333333333333333333333333333333333333333";
/** HyperCore's system address for USDC: sending it here moves USDC back to HyperEVM. */
export const CORE_USDC_SYSTEM = "0x2000000000000000000000000000000000000000";

/**
 * Addresses vaults keep touching, named the way a member would say them.
 * Keyed by lowercase address; the same contract sits at the same address on
 * every chain it is on, except where noted.
 */
export const WELL_KNOWN_LABELS: Record<string, string> = {
  [CORE_WRITER]: "HyperCore (CoreWriter)",
  [CORE_USDC_SYSTEM]: "HyperCore USDC bridge",
  // Across SpokePool on HyperEVM.
  "0x35e63ea3eb0fb7a3bc543c71fb66412e1f6b0e04": "Across bridge",
  // USDC as Circle issues it on Arbitrum One.
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC on Arbitrum",
  // USDC on Base.
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC on Base",
  // 1inch Aggregation Router v6 and v5, same address on every chain.
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch router (v5)",
  // USDC on Ethereum.
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC on Ethereum",
  // HyperEVM: USDC, the wallet that deposits it into HyperCore, and the two
  // lending venues vaults use there (Felix's USDC vault, HyperLend's pool and
  // the token it mints for a deposit).
  "0xb88339cb7199b77e23db6e890353e22632ba630f": "USDC on HyperEVM",
  "0x6b9e773128f453f5c2c60935ee2de2cbc5390a24": "USDC deposit to HyperCore",
  "0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27": "Felix USDC vault",
  "0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b": "HyperLend pool",
  "0x744e4f26ee30213989216e1632d9be3547c4885b": "HyperLend USDC (hHyperEvmUSDC)",
};

/**
 * Rethink's own contracts, by their key in the app's address book
 * (useContractAddresses). They are not verified on every explorer, so the
 * address book is the only thing that can name them there.
 */
const RETHINK_CONTRACT_NAMES: Record<string, string> = {
  GovernableFundFactoryBeaconProxy: "Vault factory",
  NAVCalculatorBeaconProxy: "NAV calculator",
  NAVExecutorBeaconProxy: "NAV executor",
  PoolPerformanceFeeBeaconProxy: "Performance fee contract",
  RethinkReader: "Rethink reader",
  WrappedTokenFactory: "Wrapped token factory",
  RethinkFundGovernerUpgradeableBeacon: "Governor beacon",
  GovernableFundUpgradeableBeacon: "Vault beacon",
  GovernableFundFlowsUpgradeableBeacon: "Vault flows beacon",
  GovernableFundNavUpgradeableBeacon: "Vault NAV beacon",
  SafeProxyFactory: "Safe proxy factory",
  SafeSingleton: "Safe singleton",
};

/** The name of one of Rethink's own contracts on that chain, from the address book. */
export const rethinkContractName = (
  addressBook: Record<string, Partial<Record<string, string>>>,
  chainId: string,
  address: string,
): string | undefined => {
  const key = address.toLowerCase();
  for (const [contract, byChain] of Object.entries(addressBook)) {
    if (byChain?.[chainId]?.toLowerCase() === key) {
      return RETHINK_CONTRACT_NAMES[contract] ?? humanizeContractName(contract);
    }
  }
  return undefined;
};

/** A token's own name for itself, as its contract reports it. */
export interface ITokenIdentity {
  name?: string;
  symbol?: string;
}

/** What an explorer calls the proxy itself rather than the contract behind it. */
const PROXY_NAME = /proxy$/i;

/**
 * A verified contract name in words: "CoreDepositWallet" reads
 * "Core Deposit Wallet", "MetaMorphoV1_1" reads "Meta Morpho V1.1",
 * "NAVExecutor" reads "NAV Executor". Acronyms and version numbers stay
 * together ("ERC20", "GnosisSafeL2" reads "Gnosis Safe L2").
 */
export const humanizeContractName = (name: string): string =>
  name
    // version suffixes the way Solidity names spell them: V1_1, V2_2
    .replace(/V(\d+)_(\d+)/g, "V$1.$2")
    .replace(/_+/g, " ")
    // a lowercase letter followed by a capital starts a word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // the last capital of an acronym starts the next word: NAVExecutor
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // so does a capital after a number: UniswapV3Pool
    .replace(/(\d)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The best name the chain and the explorer give a contract, or undefined
 * when neither says anything a person could use. A token is called by its
 * own name and symbol ("Felix USDC (feUSDC)"), anything else by its verified
 * contract name in words.
 */
export const readableContractName = ({
  contractName,
  isProxy,
  token,
}: {
  contractName?: string;
  isProxy?: boolean;
  token?: ITokenIdentity;
}): string | undefined => {
  const symbol = token?.symbol?.trim();
  if (symbol) {
    const name = token?.name?.trim();
    return name && name !== symbol ? `${name} (${symbol})` : symbol;
  }
  const contract = contractName?.trim();
  if (!contract || isProxy || PROXY_NAME.test(contract)) return undefined;
  return humanizeContractName(contract);
};

/* ---- Which protocol a contract belongs to ---------------------------------- */

/** A protocol, or a token, as the Permissions tab groups contracts under it. */
export interface IContractProtocol {
  key: string;
  name: string;
  /**
   * A DefiLlama protocol slug, a token symbol for the design system's marks,
   * or an Iconify icon where neither exists.
   */
  logo: { protocol: string } | { token: string } | { icon: string };
  /**
   * What a function does here in a word or two, where its name says it less
   * clearly (WETH's deposit wraps, a staking vault's plain send stakes).
   * "send ETH" names a send with no calldata.
   */
  actions?: Record<string, string>;
}

const PROTOCOLS: Record<string, IContractProtocol> = {
  hypercore: { key: "hypercore", name: "HyperCore", logo: { protocol: "hyperliquid" } },
  felix: { key: "felix", name: "Felix", logo: { protocol: "felix" } },
  hyperlend: { key: "hyperlend", name: "HyperLend", logo: { protocol: "hyperlend" } },
  across: { key: "across", name: "Across", logo: { protocol: "across" } },
  oneinch: { key: "oneinch", name: "1inch", logo: { protocol: "1inch-network" } },
  lido: {
    key: "lido",
    name: "Lido",
    logo: { protocol: "lido" },
    actions: { submit: "Stake ETH" },
  },
  cow: {
    key: "cow",
    name: "CoW Swap",
    logo: { protocol: "cowswap" },
    actions: { signOrder: "Place order", unsignOrder: "Cancel order" },
  },
  // No DefiLlama listing, so no logo to fetch.
  w3labs: {
    key: "w3labs",
    name: "w3.labs staking",
    logo: { icon: "material-symbols:deployed-code-outline-rounded" },
    actions: {
      createVault: "Create vault",
      requestStakeQuota: "Request quota",
      "send ETH": "Stake",
      withdrawPrincipal: "Withdraw principal",
      claimRewards: "Claim rewards",
    },
  },
  // sciETH's payout multisig: the role sends it the vault's yield.
  scieth_multisig: {
    key: "scieth_multisig",
    name: "Yield multisig",
    logo: { icon: "material-symbols:account-balance-wallet-outline-rounded" },
    actions: { "send ETH": "Send yield" },
  },
};

// Lowercased address → protocol key. The contracts vault permissions scope on
// the chains this app serves, beyond what the permissions registry lists.
const CONTRACT_PROTOCOLS: Record<string, keyof typeof PROTOCOLS> = {
  [CORE_WRITER]: "hypercore",
  "0x6b9e773128f453f5c2c60935ee2de2cbc5390a24": "hypercore",
  "0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27": "felix",
  "0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b": "hyperlend",
  "0x744e4f26ee30213989216e1632d9be3547c4885b": "hyperlend",
  "0x35e63ea3eb0fb7a3bc543c71fb66412e1f6b0e04": "across",
  "0x111111125421ca6dc452d289314280a0f8842a65": "oneinch",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "oneinch",
  // Ethereum
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "lido", // stETH
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41": "cow", // settlement
  "0xc92e8bdf79f0507f65a392b0ab4667716bfe0110": "cow", // vault relayer
  "0x23da9ade38e4477b23770ded512fd37b12381fab": "cow", // order signer
  "0xa2a9c501d1d29ff696e7045c05deef1ed7511143": "w3labs", // staking hub
  "0x51cdd86c08319283afc8d9a797efaa0458db6343": "w3labs", // sciETH's staking vault
  "0xf0b31db69b57023b2050eca2a32932dd0ceac9e9": "scieth_multisig",
};

// Lowercased token address → symbol, for grants on a token itself.
const TOKEN_SYMBOLS: Record<string, string> = {
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xb88339cb7199b77e23db6e890353e22632ba630f": "USDC",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
  "0x4200000000000000000000000000000000000006": "WETH",
};

const TOKEN_ACTIONS: Record<string, Record<string, string>> = {
  WETH: { deposit: "Wrap", withdraw: "Unwrap" },
};

/** The protocol (or token) a contract belongs to, where the app knows it. */
export const contractProtocol = (address?: string): IContractProtocol | undefined => {
  const key = (address ?? "").toLowerCase();
  const protocol = CONTRACT_PROTOCOLS[key];
  if (protocol) return PROTOCOLS[protocol];
  const symbol = TOKEN_SYMBOLS[key];
  return symbol
    ? { key: `token:${symbol}`, name: symbol, logo: { token: symbol }, actions: TOKEN_ACTIONS[symbol] }
    : undefined;
};
