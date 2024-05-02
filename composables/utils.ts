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

