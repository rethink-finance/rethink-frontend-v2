import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { GovernableFund } from "../assets/contracts/GovernableFund";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import { targetsStillInUse } from "../composables/permissions/revokePermissions";
import {
  buildAssignRolesCalldata,
  buildCuratorUpdateSettingsCalldata,
  type ILiveFundSettingsState,
} from "../composables/permissions/roleCalldata";

const fundIface = new ethers.Interface(GovernableFund.abi as any);
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);

const SAFE = "0x2222222222222222222222222222222222222222";
const GOVERNOR = "0x4444444444444444444444444444444444444444";
const COLLECTORS = [
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
];
const NEW_COLLECTORS = COLLECTORS.map((_, i) =>
  ethers.getAddress("0x" + String(i + 1).repeat(40)),
);

const LIVE: ILiveFundSettingsState = {
  settings: {
    depositFee: "100",
    withdrawFee: "0",
    performanceFee: "2000",
    managementFee: "100",
    performaceHurdleRateBps: "0",
    baseToken: "0x1111111111111111111111111111111111111111",
    safe: SAFE,
    isExternalGovTokenInUse: false,
    isWhitelistedDeposits: true,
    // What the vault stores here is the LAST delta, never the whitelist.
    allowedDepositAddrs: ["0x9999999999999999999999999999999999999999"],
    allowedManagers: ["0x9999999999999999999999999999999999999999"],
    governanceToken: "0x3333333333333333333333333333333333333333",
    fundAddress: "0x111f164d91e3f8169a7043f7094f44af87fb7ca4",
    governor: GOVERNOR,
    fundName: "Fixture Fund",
    fundSymbol: "FIX",
    feeCollectors: COLLECTORS,
  },
  fundMetadata: "{\"description\":\"live\"}",
  feePerformancePeriod: "90",
  feeManagePeriod: "7",
};

const decode = (data: string) => {
  const [settings, metadata, perf, manage] = fundIface.decodeFunctionData("updateSettings", data);
  return { settings, metadata, perf, manage };
};

describe("buildCuratorUpdateSettingsCalldata", () => {
  it("echoes the live values, with the governor as the Safe and both toggle arrays empty", () => {
    const { settings, metadata, perf, manage } = decode(
      buildCuratorUpdateSettingsCalldata(LIVE, {}),
    );
    expect(settings.governor).toBe(SAFE);
    // Stored arrays are toggle deltas: echoing them would flip live entries.
    expect([...settings.allowedDepositAddrs]).toEqual([]);
    expect([...settings.allowedManagers]).toEqual([]);
    expect(settings.performanceFee).toBe(2000n);
    expect(settings.isWhitelistedDeposits).toBe(true);
    expect([...settings.feeCollectors]).toEqual(COLLECTORS);
    expect(metadata).toBe(LIVE.fundMetadata);
    expect(perf).toBe(90n);
    expect(manage).toBe(7n);
  });

  it("changes only what it is asked to change", () => {
    const base = decode(buildCuratorUpdateSettingsCalldata(LIVE, {}));
    const moved = decode(
      buildCuratorUpdateSettingsCalldata(LIVE, { feeCollectors: NEW_COLLECTORS }),
    );
    expect([...moved.settings.feeCollectors]).toEqual(NEW_COLLECTORS);
    // Every field but the fee destinations is byte-for-byte the echo.
    const strip = (s: ethers.Result) =>
      JSON.stringify(s.toArray().slice(0, 16), (_, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(strip(moved.settings)).toBe(strip(base.settings));
    expect(moved.metadata).toBe(base.metadata);

    const whitelist = decode(
      buildCuratorUpdateSettingsCalldata(LIVE, {
        whitelistDeltas: [SAFE],
        isWhitelistedDeposits: false,
        fundMetadata: "{}",
      }),
    );
    expect([...whitelist.settings.allowedDepositAddrs]).toEqual([SAFE]);
    expect(whitelist.settings.isWhitelistedDeposits).toBe(false);
    expect(whitelist.metadata).toBe("{}");
    expect([...whitelist.settings.feeCollectors]).toEqual(COLLECTORS);
  });
});

describe("buildAssignRolesCalldata", () => {
  it("names exactly one role per call, as a label or an encoded key", () => {
    const key = ethers.encodeBytes32String("adminRole");
    for (const role of ["adminRole", key]) {
      const [member, roleKeys, memberOf] = rolesIface.decodeFunctionData(
        "assignRoles",
        buildAssignRolesCalldata(SAFE, false, role),
      );
      expect(member).toBe(SAFE);
      expect([...roleKeys]).toEqual([key]);
      expect([...memberOf]).toEqual([false]);
    }
    const [, defaultKeys] = rolesIface.decodeFunctionData(
      "assignRoles",
      buildAssignRolesCalldata(SAFE, true),
    );
    expect([...defaultKeys]).toEqual([ethers.encodeBytes32String("defaulManagerRole")]);
  });
});

describe("targetsStillInUse", () => {
  it("keeps a target while any grant on it survives, whatever the casing", () => {
    const token = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const current = [
      { target: token, selector: "0xa9059cbb" },
      { target: token.toLowerCase(), selector: "0x095ea7b3" },
      { target: SAFE, selector: "0x12345678" },
    ];
    expect(
      targetsStillInUse(current, [{ target: token.toUpperCase().replace("0X", "0x"), selector: "0x095EA7B3" }]),
    ).toEqual([token, SAFE]);
    expect(
      targetsStillInUse(current, current),
    ).toEqual([]);
  });
});
