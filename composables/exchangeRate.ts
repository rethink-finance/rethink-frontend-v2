import { ethers, type FixedNumber } from "ethers";
import { abbreviateNumber } from "~/composables/abbreviateNumber";

export const getExchangeRateText = (exchangeRateValue: FixedNumber, token0Symbol: string, token1Symbol: string) => {
  if (!exchangeRateValue) return "--"
  return `1 ${token0Symbol} = ${abbreviateNumber(parseFloat(exchangeRateValue.toString()), 3)} ${token1Symbol}`;
}


/**
 * What one share is worth, in base token.
 *
 * NAV and supply are divided as they come off the chain, with no decimal
 * adjustment, because a vault mints shares one-for-one with the base token's
 * smallest unit: CarrotFunding took 37,095.997163 USDC and issued a supply of
 * 37,097,290,463. The share token's own `decimals()` says 18 and is not to be
 * believed — scaling NAV by the 12-place gap against a 6-decimal base token
 * returned a share price of 1.14e12 for a vault trading at 1.14, and only
 * looked right on WETH vaults, where the gap happens to be zero.
 *
 * This is the figure to show a reader. It is NOT interchangeable with
 * calculateFundToBaseExchangeRate below, which answers a different question.
 */
export const calculateSharePrice = (
  totalNav: bigint,
  totalSupply: bigint,
): number => {
  // Scale up before division to avoid precision loss
  const scaleFactor = 10n ** 36n;
  const sharePriceBigInt =
    totalSupply > 0n ? (totalNav * scaleFactor) / totalSupply : 0n;

  return parseFloat(ethers.formatUnits(sharePriceBigInt, 36));
}

/**
 * Base tokens per *formatted* fund token — the rate the deposit and redemption
 * forms convert with.
 *
 * The decimal adjustment here is real work, not the bug calculateSharePrice
 * describes above. Share amounts are parsed and formatted with the share token's
 * declared decimals throughout the settlement flow (see Redeem.vue and
 * current_cycle), so on a USDC vault a balance of 37,097,290,463 renders as
 * 3.7097e-8, and it takes a rate of ~1.14e12 to turn that back into 42,150 USDC.
 * Divide NAV by supply here instead and every redemption preview is off by
 * twelve orders of magnitude.
 */
export const calculateFundToBaseExchangeRate = (
  totalNav: bigint,
  totalSupply: bigint,
  navDecimals: number,
  supplyDecimals: number,
): number => {
  const diffDecimals = navDecimals - supplyDecimals;

  // Scale totalNav to the same decimals as totalSupply for proper division
  const adjustedTotalNav = diffDecimals < 0 ? totalNav * 10n ** BigInt(-diffDecimals) : totalNav;
  const adjustedTotalSupply =
    diffDecimals > 0 ? totalSupply * 10n ** BigInt(diffDecimals) : totalSupply;

  // Perform the division
  const scaleFactor = 10n ** 36n; // Scale up before division to avoid precision loss
  const sharePriceBigInt =
    totalSupply > 0n ? (adjustedTotalNav * scaleFactor) / adjustedTotalSupply : 0n;

  // Convert to float and format the share price correctly
  return parseFloat(ethers.formatUnits(sharePriceBigInt, 36));
}
