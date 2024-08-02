
export const getExchangeRateText = (exchangeRateValue: number, token0Symbol: string, token1Symbol: string) => {
  if (!exchangeRateValue) return "--"
  let exchangeRate: string | number = exchangeRateValue;
  if (exchangeRate > 1) {
    // If the number is bigger than 1, clip it to two decimals.
    exchangeRate = exchangeRate.toFixed(2);
  }
  return `1 ${token0Symbol} = ${exchangeRate} ${token1Symbol}`;
}
