import { ethers } from "ethers";

export const formRules: Record<string, any> = {
  required: (value: any) =>
    (value !== "" && value !== undefined && value !== null) ||
    "This field is required.",
  isValidAddress: (value: any) =>
    ethers.isAddress(value) || "This address is not valid..",

  isPositiveNumber: (value: any) =>
    value > 0 || "This field must be a positive number.",

  isValidUint8: (value: any) => {
    const number = Number(value);
    return (
      (Number.isInteger(number) && number >= 0 && number <= 255) ||
      "Value must be a valid uint8 (0 to 255)."
    );
  },

  isValidUint16: (value: any) => {
    const number = Number(value);
    return (
      (Number.isInteger(number) && value >= 0 && value <= 65535) ||
      "Value must be a valid uint16 (0 to 65535)."
    );
  },
};
