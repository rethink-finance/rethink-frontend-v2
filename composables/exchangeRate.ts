import { ethers, type FixedNumber } from "ethers";
import { abbreviateNumber } from "~/composables/abbreviateNumber";

export const getExchangeRateText = (exchangeRateValue: FixedNumber, token0Symbol: string, token1Symbol: string) => {
  if (!exchangeRateValue) return "--"
  return `1 ${token0Symbol} = ${abbreviateNumber(parseFloat(exchangeRateValue.toString()), 3)} ${token1Symbol}`;
}


export const calculateSharePrice = (
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
