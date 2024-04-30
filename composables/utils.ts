import { ethers } from "ethers"
import numeral from "numeral";

export const variableType = (value: any) =>
  Object.prototype.toString.call(value).slice(8, -1) // accurately returns the parameter type [Array | Object | Number | Boolean | ...]

export const isVariableOfType = (value: any, type: any) =>
  variableType(value) === type

export const formatToEther = (wei?: number) => {
  if (wei == null) return wei
  return parseFloat(ethers.formatEther(isVariableOfType(wei, "String") ? wei : wei.toString()))
}

export const toKebabCase = (str: string) =>
  str.toLowerCase().split(" ").join("-")

export const toPascalCase = (str: string) =>
  str.split(" ")
    .map(word => word[0]
      .toUpperCase()
      .concat(word.slice(1)))
    .join("")

export const capitalizeFirst = (str?: string): string => {
  if (!str) return "";
  return str?.charAt(0).toUpperCase() + str?.slice(1);
}


/**
 * Converts a decimal number to a percentage string.
 * Optionally includes a "+" or "-" sign based on the number's positivity or negativity,
 * and the percentage value is formatted to two decimal places.
 *
 * @param {number} value - The decimal number to be converted to a percentage string.
 * @param {boolean} includeSign - Optional. If true, includes '+' or '-' sign with the percentage. Defaults to true.
 * @returns {string} A string representing the converted percentage with two decimal places.
 */
export const formatPercent = (value: number, includeSign: boolean = true): string => {
  const percentage = value * 100;
  let formattedPercentage = percentage.toFixed(2) + "%";

  if (includeSign && percentage > 0) {
    formattedPercentage = "+" + formattedPercentage;
  }

  return formattedPercentage;
}

export const trimTrailingZeros = (value: string) => {
  return value.replace(/\.?0*$/, "");
}

export const formatUSDValue = (value: string | number) => {
  return trimTrailingZeros(numeral(value).format("$0,0.00"))
}

export const formatNumberShort = (number?: number) => {
  // Formats into abbreviations with 2 decimal points, for example: 1.5K, 5.32M
  // Convert to uppercase.
  // Remove trailing ".00";
  if (number == undefined) return "N/A";
  return numeral(number).format("0.00a").toUpperCase().replace(/\.00(?=[KMBT])/g, "");
}
