import { ethers, FixedNumber } from "ethers";
import type { PositionType } from "~/types/enums/position_type";
import { PositionTypesMap } from "~/types/enums/position_type";
import type { IIcon } from "~/types/network";

export const variableType = (value: any) =>
  Object.prototype.toString.call(value).slice(8, -1); // accurately returns the parameter type [Array | Object | Number | Boolean | ...]

export const isVariableOfType = (value: any, type: any) =>
  variableType(value) === type;

export const formatToEther = (wei?: number) => {
  if (wei == null) return wei;
  return parseFloat(
    ethers.formatEther(isVariableOfType(wei, "String") ? wei : wei.toString()),
  );
};

export const toKebabCase = (str: string) =>
  str.toLowerCase().split(" ").join("-");

export const toPascalCase = (str: string) =>
  str
    .split(" ")
    .map((word) => word[0].toUpperCase().concat(word.slice(1)))
    .join("");

export const capitalizeFirst = (str?: string): string => {
  if (!str) return "";
  return str?.charAt(0).toUpperCase() + str?.slice(1);
};

// Recursive function to clean complex nested data from numeric indices
const ignoreKeys: Set<string> = new Set(["__length__"]);

/**
 * Recursively cleans complex Web3 data by processing arrays and objects.
 * - For arrays, it applies the cleaning function to each element.
 * - For objects, it creates a new object excluding keys that are numeric or in the `ignoreKeys` set.
 * - Primitive values (non-objects and non-arrays) are returned unchanged.
 *
 * It is basically done to clean the WEB3 data that comes with numeric indexes and also with the key properties
 * after the data is ABI decoded. Numeric indexes are removed.
 *
 * @param {any} data - The data to be cleaned. It can be of any type.
 * @param level Depth level when serializing nested objects.
 * @returns {any} - The cleaned data, with arrays and objects recursively processed.
 */
export const cleanComplexWeb3Data = (data: any, level: number = 0): any => {
  if (Array.isArray(data)) {
    // Recursively clean each item in the array
    return data.map((item) => cleanComplexWeb3Data(item, level + 1));
  } else if (typeof data === "object" && data !== null) {
    // Prepare an object to accumulate the cleaned data
    const cleanedData: { [key: string]: any } = {};
    Object.keys(data).forEach((key) => {
      if (ignoreKeys.has(key)) return;

      // Check if the key is not numeric, ignore numeric values, but keep hex keys like ("0x5231").
      // Ignore index keys such as { 0: {}, 1: "test" }
      if (!key.startsWith("0x") && !isNaN(Number(key))) {
        return;
      }
      // Recursively clean and assign if key is not numeric and not ignored
      cleanedData[key] = cleanComplexWeb3Data(data[key], level + 1);
    });
    return cleanedData;
  } else if (typeof data === "bigint") {
    return data.toString();
  }
  // Return primitive types unchanged
  return data;
};

export const formatJson = (data: any) => {
  /**
   * This function also sorts JSON keys alphabetically.
   * **/
  const sortKeys = (value: any): any => {
    // If the value is an array, return it as-is.
    // Arrays, unlike objects, have an inherent order that is significant and should be preserved.
    if (Array.isArray(value)) {
      return value.map(sortKeys); // Recursively apply sortKeys to each element of the array
    }

    // If the value is an object (but not null), sort its keys
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sortedObj: any, key) => {
          sortedObj[key] = sortKeys(value[key]);
          return sortedObj;
        }, {});
    }
    return value;
  };

  return JSON.stringify(
    sortKeys(data),
    (_, value) => {
      // Convert BigInt to string
      if (typeof value === "bigint") {
        return value.toString();
      }
      // Return the value unchanged if it doesn't need transformation
      return value;
    },
    2,
  );
};

export const pluralizeWord = (word: string, count?: number | bigint) => {
  if (count === undefined || count === null) return "N/A";

  let pluralized = `${count} ${word}`;
  if (count !== 1) pluralized += "s";

  return pluralized;
};

const chainIconMap: Record<string, IIcon> = {
  matic: {
    name: "cryptocurrency-color:matic",
    size: "1.5rem",
  },
  arb1: {
    name: "token-branded:arbitrum",
    size: "2rem",
  },
  eth: {
    name: "token-branded:eth",
    size: "2rem",
  },
  base: {
    name: "token:base",
    size: "2rem",
    color: "#0052ff",
  },
};

export const getChainIcon = (chainShort: string) => {
  return (
    chainIconMap[chainShort] ?? {
      name: "ph:circle-fill", // default circle fill gray
      size: "1.5rem",
    }
  );
};

export const getPositionType = (positionType: PositionType) => {
  return PositionTypesMap[positionType];
};

export const trimTrailingSlash = (str: string) => {
  return str.endsWith("/") ? str.slice(0, -1) : str;
};


/**
 * Calculates the cumulative return percentage.
 *
 * @param {bigint} totalDepositBal - The total amount of deposits, in base token units.
 * @param {bigint} totalNAV - The total Net Asset Value (NAV), in base token units.
 * @param {number} baseTokenDecimals - The number of decimals for the base token.
 * @returns {number | undefined} - The cumulative return percentage, or undefined if an error occurs.
 *
 * The formula used is:
 * cumulativeReturnPercent = ((totalNAV - totalDepositBal) / totalDepositBal) * 100
 */
export const calculateCumulativeReturnPercent = (
  totalDepositBal: bigint,
  totalNAV:bigint,
  baseTokenDecimals: number,
): number | undefined => {
  try{
    // totalNAV() - _totalDepositBal  / _totalDepositBal
    let cumulativeReturnPercent = 0;

    if (totalNAV > BigInt(0) && totalDepositBal > BigInt(0)) {
      const fixedTotalNAV = FixedNumber.fromValue(totalNAV, baseTokenDecimals);
      const fixedTotalDepositBal = FixedNumber.fromValue(totalDepositBal, baseTokenDecimals);

      // cumulativeReturnPercent = (totalNAV - totalDepositBal) / totalDepositBal
      const cumulativeReturn = fixedTotalNAV
        .sub(fixedTotalDepositBal)
        .div(fixedTotalDepositBal);

      cumulativeReturnPercent = cumulativeReturn.toUnsafeFloat();
    }
    return cumulativeReturnPercent;
  } catch (error) {
    return undefined;
  }
};

export const calculateSharpeRatio = (
  fundNAVUpdates: any,
  totalDepositBal: bigint,
): number | undefined => {
  try {
    // 1. step: calculate excess returns
    const excessReturns = calculateExcessReturns(fundNAVUpdates, totalDepositBal);

    if (excessReturns.length === 0) return undefined;

    // 2. step: calculate standard deviation of excess returns
    const sharpeRatio = _calculateSharpeRatio(excessReturns);

    // TODO bug here, rounds to 2 decimal points, but it should not! rounds small numbers to 0
    return Number(sharpeRatio?.toFixed(2));
  } catch (error) {
    console.error("Error calculating Sharpe Ratio: ", error);
    return undefined;
  }
}


export const _calculateSharpeRatio = (values: number[]): number | undefined => {
  if (values.length === 0) return undefined;

  // First calculate standard deviation.
  // Calculate the mean (average)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  // Calculate the variance
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;

  // Return the sharpe ratio.
  // Divide average returns with standard deviation of returns.
  return mean / Math.sqrt(variance);
};


export const calculateExcessReturns = (fundNavUpdates: any, totalDepositBal: bigint): number[] => {
  const excessReturns: number[] = [];

  for (const navUpdate of fundNavUpdates) {
    const totalNavAtUpdate = Number(navUpdate?.navParts?.totalNAV) || undefined;
    // const totalDepositBalAtUpdate = Number(navUpdate?.navParts?.baseAssetSafeBal || undefined);

    console.log(totalDepositBal);
    if (totalNavAtUpdate && Number(totalDepositBal) != 0) {

      const excessReturn = (totalNavAtUpdate - Number(totalDepositBal)) / Number(totalDepositBal);
      excessReturns.push(excessReturn);
    }
  }
  console.log(excessReturns);

  return excessReturns;
}
