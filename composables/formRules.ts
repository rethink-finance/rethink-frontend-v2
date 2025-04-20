import { ethers } from "ethers";

export const formRules: Record<string, any> = {
  required: (value: any) =>
    (value !== "" && value !== undefined && value !== null) ||
    "Field is required.",
  isValidAddress: (value: any) =>
    ethers.isAddress(value) || "Address is not valid.",
  isValidHexString: (value: any) =>
    ethers.isHexString(value) || "Value is not a valid hex string.",

  isPositiveNumber: (value: any) =>
    value > 0 || "Value must be a positive number.",

  isNonNegativeNumber: (value: any) =>
    value >= 0 || "Value must be a non-negative number.",

  isValidUint8: (value: any) => {
    const number = Number(value);
    return (
      (Number.isInteger(number) && number >= 0 && number <= 255) ||
      "Value must be a valid uint8 (0 to 255)."
    );
  },
  notSameAs: (otherValues: any[], customErrorMsg?: string) => (value: any) => {
    const errorMsg = customErrorMsg || "Value is not allowed.";

    return !otherValues.includes(value) || errorMsg;
  },
  isValidUint16: (value: any) => {
    const number = Number(value);
    return (
      (Number.isInteger(number) && value >= 0 && value <= 65535) ||
      "Value must be a valid uint16 (0 to 65535)."
    );
  },

  charLimit: (maxChars: number) => (value: any) => {
    return (
      (typeof value === "string" && value.length <= maxChars) ||
      `This field must be at most ${maxChars} characters.`
    );
  },

  isValidByteLength: (byteLength: number) => (value: any) => {
    const expectedLength = 2 * byteLength + 2; // 2 hex chars per byte + 2 for '0x' prefix
    return (
      value.length === expectedLength ||
      `Value must be a valid hex string of length ${byteLength} bytes.`
    );
  },
};
