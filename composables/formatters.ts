import { ethers } from "ethers";
import numeral from "numeral";

/**
 * Formats a JavaScript Date object as "24 Jul 23" (day of the month, abbreviated month name, and last two digits of the year).
 *
 * @param {Date} date - The Date object to be formatted.
 * @returns {string} The formatted date string.
 */
export const formatDate = (date: Date) => {
  if (!date) return "";
  const day = date.getDate().toString(); // Day of the month.
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()]; // Abbreviated month name
  const year = date.getFullYear().toString().slice(-2); // Last two digits of the year

  return `${day}. ${month} ${year}`;
}

/**
 * Converts a decimal number to a percentage string.
 * Optionally includes a "+" or "-" sign based on the number's positivity or negativity,
 * and the percentage value is formatted to two decimal places.
 *
 * @param {number} value - The decimal number to be converted to a percentage string.
 * @param {boolean} includeSign - Optional. If true, includes '+' or '-' sign with the percentage. Defaults to true.
 * @param defaultValue - Optional. Default return value if the passed value is null or undefined.
 * @returns {string} A string representing the converted percentage with two decimal places.
 */
export const formatPercent = (value?: number | bigint, includeSign: boolean = false, defaultValue: any = undefined): string => {
  if (value === undefined || value === null) return defaultValue;
  value = Number(value);

  const percentage = value * 100;
  let formattedPercentage = trimTrailingZeros(percentage.toFixed(2)) + "%";

  if (includeSign && percentage > 0) {
    formattedPercentage = "+" + formattedPercentage;
  }

  return formattedPercentage;
}

export const trimTrailingZeros = (value: string) => {
  return value.replace(/\.?0*$/, "");
}

export const formatNumberShort = (number?: number) => {
  // Formats into abbreviations with 2 decimal points, for example: 1.5K, 5.32M
  // Convert to uppercase.
  // Remove trailing ".00";
  if (number == undefined) return "N/A";
  return numeral(number).format("0.00a").toUpperCase().replace(/\.00(?=[KMBT])/g, "");
}

export const commify = (value: string | number | bigint) => {
  value = value.toString();

  const match = value.match(/^(-?)([0-9]*)(\.?)([0-9]*)$/);
  if (!match || (!match[2] && !match[4])) {
    throw new Error(`bad formatted number: ${ JSON.stringify(value) }`);
  }

  const neg = match[1];
  const whole = BigInt(match[2] || 0).toLocaleString("en-us");
  let frac = "";

  if (match[4]) {
    const fracMatch = match[4].match(/^(.*?)0*$/);
    if (fracMatch && fracMatch[1]) {
      frac = fracMatch[1];
      const asDecimal = parseFloat("0." + frac);

      // Round fraction to 3 decimals.
      // Shift, round, and shift back
      const rounded = Math.round(asDecimal * 1000) / 1000;

      // Convert to string and ensure it retains three decimal places.
      // Split and take only the decimal part.
      frac = rounded.toFixed(3).split(".")[1];
    }
  }

  let commifiedValue = `${ neg }${ whole }`;
  if (frac) {
    commifiedValue += `.${ frac }`
  }
  return commifiedValue;
}

/**
 * Formats a token value based on its decimals.
 *
 * @param value The value to format, either a number or a bigint.
 * @param decimals The number of decimals the token has.
 * @param shouldCommify Add commas like: "10000" -> "10,000".
 * @returns The formatted token value with a fixed precision of 3 decimal places.
 */
// export const formatTokenValue = (value: number | bigint, decimals: number): string => {
//   return trimTrailingZeros(
//     (Math.floor(Number(ethers.formatUnits(value, decimals)) * 1000) / 1000).toFixed(3),
//   );
// }

export const formatTokenValue = (value: bigint, decimals: number, shouldCommify = true): string => {
  try {
    if (Number(value) === 0) return "0";
    const formattedValue = ethers.formatUnits(value, decimals);

    return shouldCommify ? commify(formattedValue) : formattedValue;
  } catch(error: any) {
    return ethers.formatUnits(value, decimals);
  }
}

export const abiFunctionNameToLabel = (name: string) => {
  // split camelCase to words
  let output = name.replace(/([A-Z])/g, " $1");
  // capitalize the first letter
  output = output.charAt(0).toUpperCase() + output.slice(1);
  return output;
};
