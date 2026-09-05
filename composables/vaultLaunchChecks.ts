import {
  MAX_DEPOSIT_FEE_PERCENT,
  MAX_MANAGEMENT_FEE_PERCENT,
  MAX_PERFORMANCE_FEE_PERCENT,
  MAX_WITHDRAW_FEE_PERCENT,
  MIN_QUORUM_PERCENT,
  MIN_VOTING_PERIOD_SECONDS,
} from "~/composables/formRules";

/**
 * What the deployed contracts report, read straight off the chain — not the
 * form, and not the factory's parsed cache. Fees are in basis points, as the
 * vault stores them; the voting period is in blocks, as the governor does.
 */
export interface IVaultLaunchCheckInput {
  quorumNumerator: number | bigint | string;
  quorumDenominator: number | bigint | string;
  votingPeriodBlocks: number | bigint | string;
  /** Seconds per block on the chain the governor counts blocks on; 0 if unknown. */
  averageBlockTime: number;
  depositFeeBps: number | bigint | string;
  withdrawFeeBps: number | bigint | string;
  managementFeeBps: number | bigint | string;
  performanceFeeBps: number | bigint | string;
}

export type VaultLaunchCheckKey =
  | "quorum"
  | "votingPeriod"
  | "performanceFee"
  | "managementFee"
  | "depositFee"
  | "withdrawFee";

export interface IVaultLaunchCheck {
  key: VaultLaunchCheckKey;
  label: string;
  /** The rule, in words: "at least 10%". */
  requirement: string;
  /** What the contract holds, in words: "4%". */
  actual: string;
  /** Passed, failed, or could not be decided from what was read. */
  status: "pass" | "fail" | "unknown";
}

const toNumber = (value: number | bigint | string) => Number(value);

const formatPercent = (percent: number) => {
  if (!Number.isFinite(percent)) return "unknown";
  // Whole numbers read as "10%", the rest keep up to two decimals.
  return `${Number(percent.toFixed(2))}%`;
};

/** A duration in whole days, hours or minutes — the estimate a block count is. */
const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown";
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.round((seconds / size) * 10) / 10;
      return `≈ ${count} ${name}${count === 1 ? "" : "s"}`;
    }
  }
  return `≈ ${Math.round(seconds)} seconds`;
};

const feeCheck = (
  key: VaultLaunchCheckKey,
  label: string,
  bps: number | bigint | string,
  maxPercent: number,
): IVaultLaunchCheck => {
  const percent = toNumber(bps) / 100;
  const isKnown = Number.isFinite(percent);
  return {
    key,
    label,
    requirement: `at most ${maxPercent}%`,
    actual: isKnown ? formatPercent(percent) : "unknown",
    status: !isKnown ? "unknown" : percent <= maxPercent ? "pass" : "fail",
  };
};

/**
 * The checks the finalize step runs against the deployed governor and vault
 * before it lets the vault open. They repeat the limits the form enforces, so
 * a form that was bypassed, or a build that got a conversion wrong, cannot put
 * a vault live with a quorum nobody can lose or a fee nobody would accept.
 *
 * A check that cannot be decided (a block time that would not read, a value
 * that is not a number) reports "unknown" rather than passing: the step treats
 * anything but a pass as a reason not to finalize.
 */
export const evaluateVaultLaunchChecks = (
  input: IVaultLaunchCheckInput,
): IVaultLaunchCheck[] => {
  const numerator = toNumber(input.quorumNumerator);
  const denominator = toNumber(input.quorumDenominator);
  const quorumPercent =
    Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
      ? (numerator / denominator) * 100
      : NaN;

  const quorum: IVaultLaunchCheck = {
    key: "quorum",
    label: "Governance quorum",
    requirement: `at least ${MIN_QUORUM_PERCENT}%`,
    actual: Number.isFinite(quorumPercent) ? formatPercent(quorumPercent) : "unknown",
    status: !Number.isFinite(quorumPercent)
      ? "unknown"
      : quorumPercent >= MIN_QUORUM_PERCENT
        ? "pass"
        : "fail",
  };

  const blocks = toNumber(input.votingPeriodBlocks);
  const blockTime = input.averageBlockTime;
  const periodSeconds =
    Number.isFinite(blocks) && Number.isFinite(blockTime) && blockTime > 0
      ? blocks * blockTime
      : NaN;
  const minDays = MIN_VOTING_PERIOD_SECONDS / 86400;

  const votingPeriod: IVaultLaunchCheck = {
    key: "votingPeriod",
    label: "Voting period",
    requirement: `at least ${minDays} ${minDays === 1 ? "day" : "days"}`,
    actual: Number.isFinite(periodSeconds)
      ? `${blocks.toLocaleString("en-US")} blocks, ${formatSeconds(periodSeconds)}`
      : Number.isFinite(blocks)
        ? `${blocks.toLocaleString("en-US")} blocks, block time unknown`
        : "unknown",
    status: !Number.isFinite(periodSeconds)
      ? "unknown"
      : periodSeconds >= MIN_VOTING_PERIOD_SECONDS
        ? "pass"
        : "fail",
  };

  return [
    quorum,
    votingPeriod,
    feeCheck("performanceFee", "Performance fee", input.performanceFeeBps, MAX_PERFORMANCE_FEE_PERCENT),
    feeCheck("managementFee", "Management fee", input.managementFeeBps, MAX_MANAGEMENT_FEE_PERCENT),
    feeCheck("depositFee", "Deposit fee", input.depositFeeBps, MAX_DEPOSIT_FEE_PERCENT),
    feeCheck("withdrawFee", "Redemption fee", input.withdrawFeeBps, MAX_WITHDRAW_FEE_PERCENT),
  ];
};

/** True only when every check passed outright. */
export const allVaultLaunchChecksPass = (checks: IVaultLaunchCheck[]) =>
  checks.length > 0 && checks.every((check) => check.status === "pass");
