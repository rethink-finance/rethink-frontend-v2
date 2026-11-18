import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  buildFinalizeWithFirstNavCalls,
  encodeFirstNavExecution,
  firstNavRoleCandidates,
  pickFirstNavRole,
} from "../composables/onboarding/finalizeCalls";

const FACTORY = "0xD45e5D73bcD8625f8B5C4b1b6DD7Ca48Dd47F4F6";
const FUND = "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007";
const ROLES = "0x8A984794a920BBd367B3e54362014dE973200aB0";
const NAV_EXECUTOR = "0x540f022CD860c65FD4DF1969553263014C862bbd";

const NAV_CALLDATA =
  "0xa61f5814" +
  ethers.AbiCoder.defaultAbiCoder().encode(["address"], [NAV_EXECUTOR]).slice(2);

describe("buildFinalizeWithFirstNavCalls", () => {
  it("finalizes first, then runs the NAV update through the modifier", () => {
    const calls = buildFinalizeWithFirstNavCalls({
      factoryAddress: FACTORY,
      fundAddress: FUND,
      navExecutorAddress: NAV_EXECUTOR,
      route: { rolesModAddress: ROLES, role: "defaultManagerRole", version: "V2" },
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      to: FACTORY,
      data: ethers.id("finalizeCreateFund()").slice(0, 10),
    });
    expect(calls[1].to).toBe(ROLES);

    const decoded = new ethers.Interface([
      "function execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)",
    ]).decodeFunctionData("execTransactionWithRole", calls[1].data!);
    expect(decoded[0]).toBe(FUND);
    expect(decoded[1]).toBe(0n);
    expect(decoded[2]).toBe(NAV_CALLDATA);
    expect(decoded[3]).toBe(0n);
    expect(decoded[4]).toBe(ethers.encodeBytes32String("defaultManagerRole"));
    expect(decoded[5]).toBe(true);
  });
});

describe("encodeFirstNavExecution", () => {
  it("passes an already-encoded V2 role key through untouched", () => {
    const key = ethers.encodeBytes32String("Custom-Role");
    const viaLabel = encodeFirstNavExecution(FUND, NAV_EXECUTOR, {
      rolesModAddress: ROLES,
      role: "Custom-Role",
      version: "V2",
    });
    const viaKey = encodeFirstNavExecution(FUND, NAV_EXECUTOR, {
      rolesModAddress: ROLES,
      role: key,
      version: "V2",
    });
    expect(viaKey).toBe(viaLabel);
  });

  it("uses the uint16 role signature on a V1 modifier", () => {
    const data = encodeFirstNavExecution(FUND, NAV_EXECUTOR, {
      rolesModAddress: ROLES,
      role: "1",
      version: "V1",
    });
    const iface = new ethers.Interface([
      "function execTransactionWithRole(address,uint256,bytes,uint8,uint16,bool)",
    ]);
    expect(data.slice(0, 10)).toBe(
      iface.getFunction("execTransactionWithRole")!.selector,
    );
    expect(iface.decodeFunctionData("execTransactionWithRole", data)[4]).toBe(1n);
  });
});

describe("firstNavRoleCandidates", () => {
  it("puts held roles first and drops a default it already covers", () => {
    const held = ethers.encodeBytes32String("defaultManagerRole");
    expect(firstNavRoleCandidates("V2", [held, "Custom-Role"])).toEqual([
      held,
      "Custom-Role",
      "defaulManagerRole",
    ]);
  });

  it("falls back to both manager spellings on V2 and role 1 on V1", () => {
    expect(firstNavRoleCandidates("V2")).toEqual([
      "defaultManagerRole",
      "defaulManagerRole",
    ]);
    expect(firstNavRoleCandidates("V1")).toEqual(["1"]);
  });
});

describe("pickFirstNavRole", () => {
  it("accepts a role whose dry-run only fails on the uninitialised vault", async () => {
    const role = await pickFirstNavRole(["a", "b", "c"], (candidate) =>
      Promise.resolve(
        candidate === "b" ? { ok: false, innerRevert: true } : { ok: false },
      ),
    );
    expect(role).toBe("b");
  });

  it("skips a role whose dry-run threw and returns nothing when all are denied", async () => {
    const role = await pickFirstNavRole(["a", "b"], (candidate) =>
      candidate === "a"
        ? Promise.reject(new Error("rpc down"))
        : Promise.resolve({ ok: true }),
    );
    expect(role).toBe("b");
    expect(
      await pickFirstNavRole(["a"], () => Promise.resolve({ ok: false })),
    ).toBeUndefined();
  });
});
