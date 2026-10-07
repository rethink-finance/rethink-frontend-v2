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
