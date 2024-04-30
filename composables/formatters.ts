import { ethers } from "ethers";

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
 * Formats a token value based on its decimals.
 *
 * @param value The value to format, either a number or a bigint.
 * @param decimals The number of decimals the token has.
 * @returns The formatted token value with a fixed precision of 3 decimal places.
 */
export const formatTokenValue = (value: number | bigint, decimals: number): string => {
  return trimTrailingZeros(
    (Math.floor(Number(ethers.formatUnits(value, decimals)) * 1000) / 1000).toFixed(3),
  );
}
