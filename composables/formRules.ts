import { ethers } from "ethers";

export const formRules: Record<string, any> = {
  required: (value: any) =>
    (value !== "" && value !== undefined && value !== null) ||
    "This field is required.",
  isValidAddress: (value: any) =>
    ethers.isAddress(value) || "This address is not valid..",
  isPositiveNumber: (value: any) =>
    value > 0 || "This field must be a positive number.",
};
