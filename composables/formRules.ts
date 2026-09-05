import { ethers } from "ethers";

/** Lowest quorum a vault may be created with or governed under, in percent. */
export const MIN_QUORUM_PERCENT = 10;

/**
 * Shortest voting period a vault may be created with, in seconds. A vote that
 * closes within hours can be over before most holders have seen the proposal.
 */
export const MIN_VOTING_PERIOD_SECONDS = 86400;

/**
 * Highest fee of each kind a vault may charge, in percent. Anything above is
 * refused by the form, and a vault that was nevertheless deployed with more is
 * refused by the finalize step's contract checks.
 */
export const MAX_PERFORMANCE_FEE_PERCENT = 50;
export const MAX_MANAGEMENT_FEE_PERCENT = 10;
export const MAX_DEPOSIT_FEE_PERCENT = 10;
export const MAX_WITHDRAW_FEE_PERCENT = 10;

export const formRules: Record<string, any> = {
  required: (value: any) =>
    (value !== "" && value !== undefined && value !== null) ||
    "Field is required.",
  isValidAddress: (value: any) =>
    ethers.isAddress(value?.toString().toLowerCase()) || "Address is not valid.",
  isValidHexString: (value: any) =>
    ethers.isHexString(value) || "Value is not a valid hex string.",

  isPositiveNumber: (value: any) =>
    value > 0 || "Value must be a positive number.",

  isNonNegativeNumber: (value: any) =>
    value >= 0 || "Value must be a non-negative number.",

  // A governor with a tiny quorum passes any proposal on a single vote,
  // however small; that is how the TTAI treasury was drained through 0%. The
  // floor is a share of total supply, so anything under it is refused. The
  // value arrives as the bare number typed into the create flow or as the
  // formatted "50%" a vault already reports, so the number is read off the
  // front of either.
  quorumAtLeastMinimum: (value: any) => {
    const percentage = parseFloat(String(value ?? ""));
    return (
      (Number.isFinite(percentage) && percentage >= MIN_QUORUM_PERCENT) ||
      `Value must be at least ${MIN_QUORUM_PERCENT}%: a lower quorum lets a handful of votes pass any proposal.`
    );
  },

  /**
   * A percentage no higher than the ceiling. Empty is not this rule's concern:
   * `required` says so, and an optional field left blank should pass.
   */
  percentAtMost: (maxPercent: number) => (value: any) => {
    if (value === "" || value === undefined || value === null) return true;
    const percentage = parseFloat(String(value));
    return (
      (Number.isFinite(percentage) && percentage <= maxPercent) ||
      `Value must be at most ${maxPercent}%.`
    );
  },

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
