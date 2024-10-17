import type { FixedNumber } from "ethers";

export const getExchangeRateText = (exchangeRateValue: FixedNumber, token0Symbol: string, token1Symbol: string) => {
  if (!exchangeRateValue) return "--"
  return `1 ${token0Symbol} = ${exchangeRateValue.toString()} ${token1Symbol}`;
}
