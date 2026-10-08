import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import { parseRawPermissionCode } from "../composables/permissions/parseRawPermissionCode";
import {
  describeQueuedCalls,
  formatAllowancePeriod,
  groupQueuedCalls,
  queuedRoleName,
} from "../composables/permissions/rawPermissionQueue";

const iface = new ethers.Interface((RolesFullV2 as any).abi);
const EXECUTOR = ethers.encodeBytes32String("defaulManagerRole");
const ADMIN = ethers.encodeBytes32String("adminRole");
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const SAFE = "0x2222222222222222222222222222222222222222";
const abi = ethers.AbiCoder.defaultAbiCoder();

// A pasted batch in export order: one contract's calls are not adjacent.
const BATCH = [
  iface.encodeFunctionData("setAllowance", [ethers.encodeBytes32String("yieldToMultisig"), 5000n, 5000n, 5000n, 2592000n, 0n]),
  iface.encodeFunctionData("scopeTarget", [EXECUTOR, WETH]),
  iface.encodeFunctionData("allowFunction", [EXECUTOR, WETH, "0xd0e30db0", 1]),
  iface.encodeFunctionData("scopeTarget", [EXECUTOR, USDC]),
  iface.encodeFunctionData("allowFunction", [EXECUTOR, WETH, "0x2e1a7d4d", 0]),
  iface.encodeFunctionData("scopeFunction", [
    EXECUTOR,
    USDC,
    "0xa9059cbb",
    [
      [0, 5, 5, "0x"],
      [0, 1, 16, abi.encode(["address"], [SAFE])],
    ],
    0,
  ]),
  iface.encodeFunctionData("assignRoles", [SAFE, [ADMIN], [true]]),
];

describe("raw permission queue", () => {
  const calls = describeQueuedCalls(parseRawPermissionCode(BATCH.join("\n")));
  const groups = groupQueuedCalls(calls);

  it("decodes every queued call into what it does", () => {
    expect(calls.map((call) => call.description.action)).toEqual([
      "set-allowance",
      "scope-target",
      "allow-function",
      "scope-target",
      "allow-function",
      "scope-function",
      "assign-roles",
    ]);
    expect(calls[2].description.selector).toBe("0xd0e30db0");
    expect(calls[2].description.executionOption).toContain("send ETH");
    expect(calls[5].description.conditions?.children).toHaveLength(1);
    expect(calls[0].description.allowance?.key).toBe("yieldToMultisig");
    expect(calls[6].description.memberships).toEqual([{ role: "adminRole", added: true }]);
  });

  it("groups the calls by contract, in the order each is first mentioned", () => {
    expect(groups.map((group) => group.key)).toEqual([
      `target:${WETH}`,
      `target:${USDC}`,
      "members",
      "allowances",
    ]);
    // WETH's three calls sat at queue positions 1, 2 and 4.
    expect(groups[0].calls.map((call) => call.index)).toEqual([1, 2, 4]);
    expect(groups[1].calls.map((call) => call.index)).toEqual([3, 5]);
    expect(groups[0].roles).toEqual(["defaulManagerRole"]);
    expect(groups[2].roles).toEqual(["adminRole"]);
  });

  it("keeps each call's queue index, so a discard removes the right entry", () => {
    expect(groups.flatMap((group) => group.calls.map((call) => call.index)).sort()).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it("names the two vault roles and leaves any other key as it is", () => {
    expect(queuedRoleName("defaulManagerRole")).toBe("Executor");
    expect(queuedRoleName("defaultManagerRole")).toBe("Executor");
    expect(queuedRoleName("adminRole")).toBe("Admin");
    expect(queuedRoleName("treasury")).toBe("treasury");
  });

  it("states a refill period in its largest whole unit", () => {
    expect(formatAllowancePeriod("2592000")).toBe("30 days");
    expect(formatAllowancePeriod("86400")).toBe("day");
    expect(formatAllowancePeriod("7200")).toBe("2 hours");
    expect(formatAllowancePeriod("90")).toBe("90 seconds");
    expect(formatAllowancePeriod("0")).toBe("");
  });
});
