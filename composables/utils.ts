import { ethers } from "ethers"
import type { PositionType } from "~/types/enums/position_type";
import { PositionTypesMap } from "~/types/enums/position_type";

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
 * @returns {any} - The cleaned data, with arrays and objects recursively processed.
 */
export const cleanComplexWeb3Data = (data: any): any =>  {
  if (Array.isArray(data)) {
    // Recursively clean each item in the array
    return data.map(item => cleanComplexWeb3Data(item));
  } else if (typeof data === "object" && data !== null) {
    // Prepare an object to accumulate the cleaned data
    const cleanedData: { [key: string]: any } = {};
    Object.keys(data).forEach(key => {
      // Check if the key is not numeric
      if (!ignoreKeys.has(key) && isNaN(Number(key))) {
        // Recursively clean and assign if key is not numeric and not ignored
        cleanedData[key] = cleanComplexWeb3Data(data[key]);
      }
    });
    return cleanedData;
  }
  // Return primitive types unchanged
  return data;
}

export const formatJson = (data: any) => {
  return JSON.stringify(data, (_, value) => {
    if (typeof value === "bigint") {
      // Convert BigInt to string
      return value.toString();
    }
    // Return the value unchanged if not a BigInt
    return value;
  }, 2);
}

export const pluralizeWord = (word: string, count?: number | bigint) => {
  if (count === undefined || count === null) return "N/A";

  let pluralized = `${count} ${word}`
  if (count !== 1) pluralized += "s"

  return pluralized;
}

const chainIconMap: Record<string, Record<string, string>> = {
  matic: {
    name: "cryptocurrency-color:matic",
    size: "1.5rem",
  },
  arb1: {
    name: "token-branded:arbitrum",
    size: "2rem",
  },
};

export const getChainIcon = (chainShort: string) => {
  return chainIconMap[chainShort] ?? {
    name: "ph:circle-fill", // default circle fill gray
    size: "1.5rem",
  };
}


export const getPositionType = (positionType: PositionType) => {
  return PositionTypesMap[positionType];
}
