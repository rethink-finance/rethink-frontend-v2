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

  return `${day} ${month} ${year}`;
}

/**
 * Formats a date string into "Day Mon dd, yyyy, hh:mm am/pm" format.
 *
 * @param {Date} date - The Date object to be formatted.
 * @returns {string} The formatted date string.
 */
export const formatDateLong = (date: Date) => {
  if(!date) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const dayName = days[date.getUTCDay()];
  const monthName = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear(); // Full year
  let hour = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12;
  hour = hour || 12; // the hour '0' should be '12'

  return `${dayName} ${monthName} ${day}, ${year}, ${hour}:${minutes} ${ampm}`;
}

/**
 * Formats a Date object into a localized string representation.
 *
 * The format will be: "Day Mon dd, yyyy, hh:mm am/pm" for locales using the 12-hour clock,
 * and may vary based on the locale provided (defaults to 'en-US').
 *
 * @param {Date} date - The Date object to be formatted.
 * @returns {string} The formatted date string in the format "Day Mon dd, yyyy, hh:mm am/pm"
 *                   or according to the provided locale's default format.
 */
export const formatDateToLocaleString = (date: Date, includeWeekday = true) => {
  if (!date) return "";

  // TODO: we can add a locale parameter to this function to allow for custom locale formatting.
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",    // e.g., "2023"
    month: "short",     // e.g., "Jan"
    day: "numeric",     // e.g., "5"
    hour: "numeric",    // e.g., "5 PM"
    minute: "2-digit",  // e.g., "05"
    hour12: false,        // 12-hour clock, "AM/PM"
  };

  if (includeWeekday) {
    options.weekday = "short"; // e.g., "Mon"
  }

  return date.toLocaleString("en-US", options);
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
  const num = parseFloat(value);
  if (isNaN(num) || !value.includes(".")) return value;
  return value.replace(/\.?0*$/, "");
}

export const formatNumberShort = (number?: number | bigint | string | null) => {
  // Formats into abbreviations with 2 decimal points, for example: 1.5K, 5.32M
  // Convert to uppercase.
  // Remove trailing ".00";
  try {
    if (number === undefined || number === null || isNaN(Number(number))) return "N/A";

    const numericValue = Number(number);

    // Handle exact zero as a special case
    if (numericValue === 0) {
      return "0";
    }

    // Format the number with two decimal places and abbreviation
    let formatted = numeral(numericValue).format("0.00a").toUpperCase();

    // Handle cases like '1.00' -> '1' (whole numbers without abbreviations)
    formatted = formatted.replace(/\.00$/, "");

    // Remove unnecessary ".0" from abbreviations like '1.0T' -> '1T'
    formatted = formatted.replace(/(\.\d)0(?=[KMBT])/g, "$1"); // Handles decimals like 1.50K -> 1.5K
    formatted = formatted.replace(/\.0(?=[KMBT])/g, "");       // Handles exact whole numbers like 1.0T -> 1T
    return formatted;
  } catch (error: any) {
    console.error("failed formatNumberShort ", number, error);
    return number;
  }
};

export const commify = (value: string | number | bigint) => {
  value = value.toString();

  const match = value.match(/^(-?)([0-9]*)(\.?)([0-9]*)$/);
  if (!match || (!match[2] && !match[4])) {
    throw new Error(`bad formatted number: ${JSON.stringify(value)}`);
  }

  const neg = match[1];
  const whole = BigInt(match[2] || 0).toLocaleString("en-us");
  let frac = "";

  if (match[4]) {
    const fracDigits = match[4];
    const asDecimal = parseFloat("0." + fracDigits);

    // Retain the first 3 significant digits
    const significantDigits = Number(asDecimal.toPrecision(3));

    // Convert to string, remove "0." prefix
    frac = significantDigits.toString().split(".")[1] || "";
  }

  let commifiedValue = `${neg}${whole}`;
  if (frac) {
    commifiedValue += `.${frac}`;
  }
  return commifiedValue;
}

/**
 * Formats a token value based on its decimals.
 *
 * @param value The value to format, either a number or a bigint.
 * @param decimals The number of decimals the token has.
 * @param shouldCommify Add commas like: "10000" -> "10,000".
 * @param shouldRoundToSignificantDecimals Round to first 3 non-zero digits after the decimal point.".
 * @returns The formatted token value with a fixed precision of 3 decimal places.
 */

export const formatTokenValue = (
  value?: bigint,
  decimals?: number,
  shouldCommify = true,
  shouldRoundToSignificantDecimals = false,
): string => {
  if (!value || !decimals) return "0";

  try {
    if (Number(value) === 0) return "0";
    let formattedValue = ethers.formatUnits(value, decimals);
    if (shouldRoundToSignificantDecimals) {
      formattedValue = roundToSignificantDecimals(formattedValue, 3);
    }

    return shouldCommify ? commify(formattedValue) : formattedValue;
  } catch (error: any) {
    return ethers.formatUnits(value, decimals);
  }
}

export const roundToSignificantDecimals = (value: number | string, precision: number = 3): string => {
  if (value === 0 || value === "0" || !value) return "0";

  // Convert the string to a number in scientific notation
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  if (Number.isInteger(num)) return num.toString();

  // Convert to scientific notation
  const scientificNotation = num.toExponential();

  // Split into the coefficient and the exponent
  const [coefficient, exponent] = scientificNotation.split("e");

  // Round the coefficient to the desired precision
  const roundedCoefficient = parseFloat(parseFloat(coefficient).toPrecision(precision)).toString();

  // Combine the rounded coefficient with the exponent
  const roundedNumber = roundedCoefficient + "e" + exponent;

  // Convert back to a string in standard notation
  return parseFloat(roundedNumber).toString();
}


// we use this to convert the fee from bps to percentage and vice versa
export const fromBpsToPercentage = (feeBps?: any) => {
  if (feeBps === undefined || feeBps === null) return "0";
  const feePercent = (Number(feeBps) / 100).toString();
  return feePercent;
};

export const fromPercentageToBps = (feePercent?: any) => {
  if (feePercent === undefined || feePercent === null) return "0";
  const feeBps = (Number(feePercent) * 100).toString();
  return feeBps;
};
