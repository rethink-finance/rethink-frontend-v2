import { describe, expect, it } from "vitest";
import {
  isTxHash,
  normalizeMonitoringOverview,
  type ActivityFlag,
} from "../services/backend/monitoring";

const vault = (extra: Record<string, unknown> = {}) => ({
  chainId: "0x1",
  fundAddress: "0x" + "ab".repeat(20),
  fundName: "sniETH",
  fundSymbol: "sniETH",
  flags: [],
  level: "none",
  liveProposals: 0,
  flaggedProposals: 0,
  ...extra,
});

const flag = (extra: Partial<ActivityFlag> = {}): ActivityFlag => ({
  code: "roles-execution",
  severity: "medium",
  title: "Hot key claimed rewards",
  txHash: "0x" + "cd".repeat(32),
  blockNumber: "100",
  blockTimestamp: 1_760_000_000,
  contractAddress: "0x" + "ef".repeat(20),
  eventName: "ExecutionFromModuleSuccess",
  ...extra,
});

describe("normalizeMonitoringOverview", () => {
  it("fills the activity fields an older backend does not send", () => {
    const overview = normalizeMonitoringOverview({
      generatedAt: "2026-11-07T00:00:00Z",
      chains: [],
      vaults: [vault()],
      live: [],
      executable: [],
      recent: [],
      summary: { liveProposals: 0, flaggedLive: 0, criticalLive: 0, executableProposals: 0, flaggedExecutable: 0, vaults: 1, vaultsAtRisk: 0 },
    });
    expect(overview.activity).toEqual([]);
    expect(overview.summary.activityAlerts).toBe(0);
    expect(overview.summary.vaults).toBe(1);
    expect(overview.vaults[0].activity).toEqual([]);
    expect(overview.vaults[0].activityLevel).toBe("none");
    expect(overview.vaults[0].activityAlerts).toBe(0);
  });

  it("keeps the activity fields a current backend sends", () => {
    const f = flag({ severity: "high" });
    const overview = normalizeMonitoringOverview({
      generatedAt: "2026-11-07T00:00:00Z",
      chains: [],
      vaults: [vault({ activity: [f], activityLevel: "high", activityAlerts: 1 })],
      live: [],
      executable: [],
      recent: [],
      activity: [{ ...f, chainId: "0x1", fundAddress: "0x1", fundName: "sniETH", fundSymbol: "sniETH" }],
      summary: { liveProposals: 0, flaggedLive: 0, criticalLive: 0, executableProposals: 0, flaggedExecutable: 0, vaults: 1, vaultsAtRisk: 1, activityAlerts: 1 },
    });
    expect(overview.activity).toHaveLength(1);
    expect(overview.activity[0].title).toBe("Hot key claimed rewards");
    expect(overview.summary.activityAlerts).toBe(1);
    expect(overview.vaults[0].activityLevel).toBe("high");
    expect(overview.vaults[0].activityAlerts).toBe(1);
  });

  it("survives a payload with no lists at all", () => {
    const overview = normalizeMonitoringOverview({ generatedAt: "x", summary: {} });
    expect(overview.vaults).toEqual([]);
    expect(overview.live).toEqual([]);
    expect(overview.activity).toEqual([]);
    expect(overview.summary.activityAlerts).toBe(0);
  });
});

describe("isTxHash", () => {
  it("accepts a 32-byte hash and nothing else", () => {
    expect(isTxHash("0x" + "cd".repeat(32))).toBe(true);
    expect(isTxHash("0x" + "CD".repeat(32))).toBe(true);
    expect(isTxHash("poll:share-price:0x1")).toBe(false);
    expect(isTxHash("")).toBe(false);
    expect(isTxHash(undefined)).toBe(false);
    expect(isTxHash("0x" + "ab".repeat(20))).toBe(false);
  });
});
