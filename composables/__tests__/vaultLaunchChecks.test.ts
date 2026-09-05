import { describe, expect, it } from "vitest";
import {
  allVaultLaunchChecksPass,
  evaluateVaultLaunchChecks,
  type IVaultLaunchCheckInput,
} from "../vaultLaunchChecks";

/** A vault as the create flow's defaults deploy it on a 12-second chain. */
const sound: IVaultLaunchCheckInput = {
  quorumNumerator: 50,
  quorumDenominator: 100,
  votingPeriodBlocks: 36000, // 5 days at 12 s
  averageBlockTime: 12,
  depositFeeBps: 0,
  withdrawFeeBps: 100,
  managementFeeBps: 200,
  performanceFeeBps: 2000,
};

const statusOf = (input: IVaultLaunchCheckInput, key: string) =>
  evaluateVaultLaunchChecks(input).find((check) => check.key === key)?.status;

describe("evaluateVaultLaunchChecks", () => {
  it("passes a vault deployed within every limit", () => {
    const checks = evaluateVaultLaunchChecks(sound);
    expect(checks.map((c) => c.status)).toEqual(["pass", "pass", "pass", "pass", "pass", "pass"]);
    expect(allVaultLaunchChecksPass(checks)).toBe(true);
  });

  it("reads the on-chain values as bigints and strings alike", () => {
    const checks = evaluateVaultLaunchChecks({
      ...sound,
      quorumNumerator: 10n,
      quorumDenominator: "100",
      votingPeriodBlocks: "7200",
      performanceFeeBps: 5000n,
    });
    expect(allVaultLaunchChecksPass(checks)).toBe(true);
  });

  it("refuses a quorum under 10%, zero included", () => {
    expect(statusOf({ ...sound, quorumNumerator: 9 }, "quorum")).toBe("fail");
    expect(statusOf({ ...sound, quorumNumerator: 0 }, "quorum")).toBe("fail");
    expect(statusOf({ ...sound, quorumNumerator: 10 }, "quorum")).toBe("pass");
  });

  it("refuses a voting period shorter than a day, measured in block time", () => {
    // 7200 blocks is a day at 12 s but under four hours at 2 s.
    expect(statusOf({ ...sound, votingPeriodBlocks: 7200, averageBlockTime: 12 }, "votingPeriod")).toBe("pass");
    expect(statusOf({ ...sound, votingPeriodBlocks: 7200, averageBlockTime: 2 }, "votingPeriod")).toBe("fail");
    expect(statusOf({ ...sound, votingPeriodBlocks: 7199, averageBlockTime: 12 }, "votingPeriod")).toBe("fail");
  });

  it("cannot decide the voting period without a block time, and says so", () => {
    const check = evaluateVaultLaunchChecks({ ...sound, averageBlockTime: 0 })
      .find((c) => c.key === "votingPeriod")!;
    expect(check.status).toBe("unknown");
    expect(check.actual).toMatch(/block time unknown/);
    expect(allVaultLaunchChecksPass(evaluateVaultLaunchChecks({ ...sound, averageBlockTime: 0 }))).toBe(false);
  });

  it("caps each fee at its own ceiling, in basis points", () => {
    expect(statusOf({ ...sound, performanceFeeBps: 5000 }, "performanceFee")).toBe("pass");
    expect(statusOf({ ...sound, performanceFeeBps: 5001 }, "performanceFee")).toBe("fail");
    expect(statusOf({ ...sound, managementFeeBps: 1000 }, "managementFee")).toBe("pass");
    expect(statusOf({ ...sound, managementFeeBps: 1001 }, "managementFee")).toBe("fail");
    expect(statusOf({ ...sound, depositFeeBps: 1000 }, "depositFee")).toBe("pass");
    expect(statusOf({ ...sound, depositFeeBps: 1001 }, "depositFee")).toBe("fail");
    expect(statusOf({ ...sound, withdrawFeeBps: 1000 }, "withdrawFee")).toBe("pass");
    expect(statusOf({ ...sound, withdrawFeeBps: 1001 }, "withdrawFee")).toBe("fail");
  });

  it("reports an unreadable fee as unknown rather than passing it", () => {
    expect(statusOf({ ...sound, managementFeeBps: "N/A" }, "managementFee")).toBe("unknown");
  });

  it("prints what it read beside what it wanted", () => {
    const checks = evaluateVaultLaunchChecks({ ...sound, quorumNumerator: 4, performanceFeeBps: 6000 });
    const quorum = checks.find((c) => c.key === "quorum")!;
    expect(quorum.actual).toBe("4%");
    expect(quorum.requirement).toBe("at least 10%");
    const performance = checks.find((c) => c.key === "performanceFee")!;
    expect(performance.actual).toBe("60%");
    expect(performance.requirement).toBe("at most 50%");
    const period = checks.find((c) => c.key === "votingPeriod")!;
    expect(period.actual).toBe("36,000 blocks, ≈ 5 days");
  });

  it("does not pass an empty list", () => {
    expect(allVaultLaunchChecksPass([])).toBe(false);
  });
});
