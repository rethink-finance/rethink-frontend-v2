import { trimTrailingZeros } from "~/composables/utils";

/**
 * Example usage:
 * console.log(formatNumber(1000)); // Outputs: "1K"
 * console.log(formatNumber(1025000)); // Outputs: "1.0M"
 * console.log(formatNumber(1300000000)); // Outputs: "1.3B"
 */
export const abbreviateNumber = (value: any) => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return value; // Return as is if not a valid number
  }

  const abbreviations = ["K", "M", "B", "T"];
  let roundedValue = num;
  let abbreviation = "";

  for (let i = abbreviations.length - 1; i >= 0; i--) {
    const lower = Math.pow(1000, i + 1);
    if (num >= lower) {
      roundedValue = num / lower;
      abbreviation = abbreviations[i];
      break;
    }
  }

  // Round to 1 decimal and cut trailing zeros.
  return trimTrailingZeros(roundedValue.toFixed(1)) + abbreviation;
}
