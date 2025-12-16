import { trimTrailingZeros } from "~/composables/formatters";

/**
 * Example usage:
 * console.log(formatNumber(1000)); // Outputs: "1K"
 * console.log(formatNumber(1025000)); // Outputs: "1.0M"
 * console.log(formatNumber(1300000000)); // Outputs: "1.3B"
 */
export const abbreviateNumber = (value: any, toPrecision?: number): string => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return value; // Return as is if not a valid number
  }

  const sign = num < 0 ? -1 : 1;
  const absNum = Math.abs(num);

  // If number is not bigger than 1000, do not modify it (no abbreviation, no rounding)
  // For exactly 1000, always return as-is without formatting
  if (absNum < 1000) {
    // If precision not provided, return original formatting (no changes)
    if (toPrecision === undefined) {
      return typeof value === "string" ? value : String(value);
    }
    // Precision provided: format using Number.toPrecision on the numeric value
    return num.toPrecision(toPrecision);
  }

  const abbreviations = ["K", "M", "B", "T"];
  let roundedValue = absNum;
  let abbreviation = "";

  for (let i = abbreviations.length - 1; i >= 0; i--) {
    const lower = Math.pow(1000, i + 1);
    if (absNum >= lower) {
      roundedValue = absNum / lower;
      abbreviation = abbreviations[i];
      break;
    }
  }

  // Abbreviation formatting:
  // - Default: 1 decimal place, then trim all trailing zeros
  // - If toPrecision provided: keep decimals up to (toPrecision - 1) places.
  //   Trim entire decimal part only if it's all zeros (e.g., 10.00 -> 10),
  //   but preserve trailing zeros if there is any non-zero decimal (e.g., 1.50 -> 1.50).
  const decimalPlaces = Math.max(0, (toPrecision ?? 2) - 1);
  const withSign = roundedValue * sign;
  const fixedAbs = Math.abs(withSign).toFixed(decimalPlaces);

  let numericPart: string;
  if (toPrecision === undefined) {
    numericPart = trimTrailingZeros(fixedAbs);
  } else if (decimalPlaces === 0) {
    numericPart = fixedAbs; // integer
  } else {
    const [intPart, fracPart] = fixedAbs.split(".");
    if (/^0+$/.test(fracPart)) {
      numericPart = intPart; // all zeros -> trim decimals entirely
    } else {
      numericPart = intPart + "." + fracPart; // preserve provided precision (including trailing zeros)
    }
  }

  // For larger units (M, B, T), trim trailing zeros in the fractional part
  // when precision is provided. For K, keep the provided fractional zeros.
  if (toPrecision !== undefined && abbreviation && abbreviation !== "K") {
    numericPart = trimTrailingZeros(numericPart);
  }

  const signed = (sign < 0 ? "-" : "") + numericPart;
  return signed + abbreviation;
}
