import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

export interface IRawPermissionCodeEntry {
  data: string;
  label: string;
}

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const describe = (parsed: ethers.TransactionDescription): string => {
  const parts: string[] = [parsed.name];
  // Most Roles admin functions lead with (bytes32 roleKey, address target).
  try {
    const [first, second] = parsed.args;
    if (typeof first === "string" && first.length === 66) {
      parts.push(ethers.decodeBytes32String(first));
    }
    if (typeof second === "string" && ethers.isAddress(second)) {
      parts.push(`${second.slice(0, 8)}…${second.slice(-4)}`);
    } else if (typeof first === "string" && ethers.isAddress(first)) {
      parts.push(`${first.slice(0, 8)}…${first.slice(-4)}`);
    }
  } catch {
    // roleKey not a clean UTF-8 string — keep just the function name
  }
  return parts.join(" · ");
};

/**
 * Parse pasted raw Roles V2 calldata — newline/whitespace/comma separated
 * hex strings, or a JSON array of hex strings. Every entry must decode
 * against the Roles V2 ABI; the first failure throws with a 1-based entry
 * index so the input component can surface it.
 */
export const parseRawPermissionCode = (
  raw: string,
): IRawPermissionCodeEntry[] => {
  const trimmed = raw.trim();
  let candidates: string[];
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Input is not valid JSON.");
    }
    if (
      !Array.isArray(parsed) ||
      parsed.some((x) => typeof x !== "string")
    ) {
      throw new Error("JSON input must be an array of hex strings.");
    }
    candidates = parsed;
  } else {
    candidates = trimmed.split(/[\s,]+/).filter(Boolean);
  }

  return candidates.map((candidate, i) => {
    const data = candidate.trim();
    if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10 || data.length % 2) {
      throw new Error(`Entry ${i + 1} is not valid hex calldata.`);
    }
    let parsed: ethers.TransactionDescription | null = null;
    try {
      parsed = rolesInterface.parseTransaction({ data });
    } catch {
      parsed = null;
    }
    if (!parsed) {
      throw new Error(
        `Entry ${i + 1} does not decode against the Roles V2 ABI ` +
          `(selector ${data.slice(0, 10)}).`,
      );
    }
    return { data, label: describe(parsed) };
  });
};
