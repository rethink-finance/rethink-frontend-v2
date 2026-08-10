import { ERC20 } from "~/assets/contracts/ERC20";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Selector of `valueOf(address)` on GovernableFund — the accessor a vault uses
 * to price a holder's shares. A composable NAV method that calls it is a
 * position in another vault.
 */
const VALUE_OF_SELECTOR = "0xa48028aa";

/** `valueOf(address)`, ignoring the quoting the NAV method details carry. */
export const isValueOfSignature = (signature?: string): boolean =>
  (signature ?? "").replace(/["'\s]/g, "") === "valueOf(address)";

/**
 * The holder whose shares a `valueOf(address)` call prices, read out of the
 * encoded calldata rather than assumed to be this fund's safe — the method
 * author is free to point it anywhere.
 */
export const decodeValueOfHolder = (encodedCall?: string): string | undefined => {
  const data = (encodedCall ?? "").toLowerCase();
  if (!data.startsWith(VALUE_OF_SELECTOR) || data.length !== 10 + 64) {
    return undefined;
  }
  return "0x" + data.slice(-40);
};

interface IVaultSnapshot {
  totalSimulatedNav: bigint;
  totalSupply: bigint;
  baseDecimals: number;
}

/**
 * Latest simulated valuation of a vault, from the backend that re-prices every
 * vault's positions on a schedule. Returns undefined for an address the backend
 * does not know as a vault, which is how we tell a cross-vault position apart
 * from any other composable call.
 */
const fetchVaultSnapshot = async (
  chainId: ChainId,
  vaultAddress: string,
): Promise<IVaultSnapshot | undefined> => {
  const config = useRuntimeConfig();

  try {
    const response = await fetch(
      `${config.public.BACKEND_URL}/nav/latest-snapshot/${vaultAddress}?fundChainId=${chainId}`,
    );
    if (!response.ok) return undefined;

    const data = await response.json();
    if (!data?.totalSimulatedNav || !data?.totalSupply) return undefined;

    return {
      totalSimulatedNav: BigInt(data.totalSimulatedNav),
      totalSupply: BigInt(data.totalSupply),
      baseDecimals: Number(data.baseDecimals ?? 18),
    };
  } catch (error) {
    console.warn(
      "[VAULT POSITION] no snapshot for",
      chainId,
      vaultAddress,
      error,
    );
    return undefined;
  }
};

/**
 * Current value of a holding in another Rethink vault.
 *
 * A vault's own `valueOf(holder)` prices shares against `totalNAV()`, which is
 * whatever the last *executed* NAV update wrote on chain. Vaults are re-valued
 * far more often than they execute an update, so a position in a vault that has
 * not settled recently is reported at a stale price — DoC Treasury Protection,
 * for instance, was last written at 53k while it is currently worth 109k, and
 * every depositor's position was understated by half.
 *
 * So price the shares against the vault's current simulated NAV instead. It is
 * the same arithmetic the vault contract does, marked to today's valuation:
 *
 *   value = simulatedNav x holderShares / totalShares
 *
 * Returns undefined when the address is not a vault we can value this way, and
 * the caller falls back to the on-chain simulation.
 */
export const fetchRethinkVaultPositionValue = async (
  chainId: ChainId,
  vaultAddress: string,
  holderAddress: string,
  targetDecimals: number,
): Promise<bigint | undefined> => {
  const web3Store = useWeb3Store();

  const snapshot = await fetchVaultSnapshot(chainId, vaultAddress);
  if (!snapshot || snapshot.totalSupply === 0n) return undefined;

  let holderShares: bigint;
  try {
    const shareToken = web3Store.getCustomContract(chainId, ERC20, vaultAddress);
    holderShares = BigInt(
      await web3Store.callWithRetry(chainId, () =>
        shareToken.methods.balanceOf(holderAddress).call(),
      ),
    );
  } catch (error) {
    console.warn(
      "[VAULT POSITION] could not read share balance",
      vaultAddress,
      holderAddress,
      error,
    );
    return undefined;
  }

  const value =
    (snapshot.totalSimulatedNav * holderShares) / snapshot.totalSupply;

  // The value is denominated in the other vault's base asset. Line the decimals
  // up with this fund's; nothing converts between different base *currencies*,
  // which is also true of the on-chain path this replaces.
  const decimalShift = targetDecimals - snapshot.baseDecimals;
  if (decimalShift > 0) return value * 10n ** BigInt(decimalShift);
  if (decimalShift < 0) return value / 10n ** BigInt(-decimalShift);
  return value;
};
