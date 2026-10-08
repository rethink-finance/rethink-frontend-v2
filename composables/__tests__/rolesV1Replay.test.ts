import { describe, expect, it } from "vitest";
import gcftLogs from "~/composables/__tests__/mock_data/permissions/gcftRolesV1Logs.json";
import {
  type IRolesV1Log,
  reduceRolesV1Logs,
  rolesV1Interface,
  rolesV1ReplayTopics,
} from "~/services/onchain/rolesV1Replay";
import {
  ConditionType,
  ParamComparison,
  ParameterType,
} from "~/types/enums/zodiac-roles";

const MODIFIER = "0x773Df41cD92E60c32BC6AC8001E251C6cd46BC26";
const MEMBER = "0x77F252b5a4C1192efe09fCd7f9934A39c62ec85E";
const TARGET = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const OTHER_TARGET = "0xFF162c694eAA571f685030649814282eA457f169";
const SELECTOR = "0xa9059cbb";
const pad = (address: string) =>
  "0x" + address.slice(2).toLowerCase().padStart(64, "0");

/**
 * Synthetic logs, encoded with the same interface the replay decodes with,
 * numbered in the order given so block/log ordering is the array order.
 */
const logsOf = (events: [string, unknown[]][]): IRolesV1Log[] =>
  events.map(([name, args], i) => {
    const { data, topics } = rolesV1Interface.encodeEventLog(name, args);
    return { data, topics, blockNumber: 100 + i, logIndex: i };
  });

const roleOf = (logs: IRolesV1Log[]) => reduceRolesV1Logs(logs, MODIFIER)!.roles[0];
const targetOf = (logs: IRolesV1Log[]) => roleOf(logs).targets[0];
const functionOf = (logs: IRolesV1Log[]) => targetOf(logs).functions[0];

describe("reduceRolesV1Logs", () => {
  it("returns null when none of the logs is a Roles v1 event", () => {
    expect(reduceRolesV1Logs([], MODIFIER)).toBeNull();
    // A beacon proxy's BeaconUpgraded — emitted from the modifier's address,
    // but not a Roles event.
    const upgrade: IRolesV1Log = {
      topics: ["0x1cf3b03a6cf19fa2baba4df148e9dcabedea7f8a5c07840e207e5c089be95d3e"],
      data: "0x",
      blockNumber: 1,
      logIndex: 0,
    };
    expect(reduceRolesV1Logs([upgrade], MODIFIER)).toBeNull();
    expect(rolesV1ReplayTopics.has(upgrade.topics[0])).toBe(false);
  });

  it("reads the modifier's avatar from its setup event and lists no roles yet", () => {
    const modifier = reduceRolesV1Logs(
      logsOf([["RolesModSetup", [MEMBER, MEMBER, TARGET, TARGET]]]),
      MODIFIER,
    );
    expect(modifier).toEqual({
      id: MODIFIER.toLowerCase(),
      address: MODIFIER.toLowerCase(),
      avatar: TARGET.toLowerCase(),
      roles: [],
    });
  });

  it("tracks membership as last-write-wins and keeps the role once seen", () => {
    const added = logsOf([["AssignRoles", [MEMBER, [1], [true]]]]);
    expect(roleOf(added)).toMatchObject({
      id: `${MODIFIER.toLowerCase()}-ROLE-1`,
      name: "1",
      members: [
        {
          id: `${MODIFIER.toLowerCase()}-MEMBER-${MEMBER.toLowerCase()}-${MODIFIER.toLowerCase()}-ROLE-1`,
          member: {
            id: `${MODIFIER.toLowerCase()}-MEMBER-${MEMBER.toLowerCase()}`,
            address: MEMBER.toLowerCase(),
          },
        },
      ],
    });

    const removed = logsOf([
      ["AssignRoles", [MEMBER, [1], [true]]],
      ["AssignRoles", [MEMBER, [1, 2], [false, true]]],
    ]);
    const roles = reduceRolesV1Logs(removed, MODIFIER)!.roles;
    expect(roles.map((role) => role.name)).toEqual(["1", "2"]);
    expect(roles[0].members).toEqual([]);
    expect(roles[1].members.map((assignment) => assignment.member.address)).toEqual([
      MEMBER.toLowerCase(),
    ]);
  });

  it("moves a target between allowed, scoped and revoked without losing its functions", () => {
    const allowed = logsOf([["AllowTarget", [1, TARGET, 3]]]);
    expect(targetOf(allowed)).toMatchObject({
      id: `${MODIFIER.toLowerCase()}-ROLE-1-TARGET-${TARGET.toLowerCase()}`,
      address: TARGET.toLowerCase(),
      clearance: ConditionType.WILDCARDED,
      executionOptions: "Both",
      functions: [],
    });

    const scoped = logsOf([
      ["AllowTarget", [1, TARGET, 3]],
      ["ScopeAllowFunction", [1, TARGET, SELECTOR, 1, 0]],
      ["ScopeTarget", [1, TARGET]],
    ]);
    expect(targetOf(scoped)).toMatchObject({
      clearance: ConditionType.SCOPED,
      executionOptions: "None",
    });
    expect(targetOf(scoped).functions).toHaveLength(1);

    const revoked = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeAllowFunction", [1, TARGET, SELECTOR, 1, 0]],
      ["RevokeTarget", [1, TARGET]],
    ]);
    expect(targetOf(revoked)).toMatchObject({
      clearance: ConditionType.BLOCKED,
      executionOptions: "None",
    });
    // The contract keeps the function grant; a later scopeTarget revives it.
    expect(targetOf(revoked).functions.map((func) => func.sighash)).toEqual([SELECTOR]);
  });

  it("ignores revokes of targets and functions it never saw", () => {
    const logs = logsOf([
      ["RevokeTarget", [1, TARGET]],
      ["ScopeRevokeFunction", [1, TARGET, SELECTOR, 0]],
      ["UnscopeParameter", [1, TARGET, SELECTOR, 0, 0]],
    ]);
    expect(reduceRolesV1Logs(logs, MODIFIER)!.roles).toEqual([]);
  });

  it("scopes a function with only the parameters flagged as scoped", () => {
    const logs = logsOf([
      ["ScopeTarget", [1, TARGET]],
      [
        "ScopeFunction",
        [
          1,
          TARGET,
          SELECTOR,
          [true, false, true],
          [0, 0, 2],
          [1, 0, 3],
          [pad(MEMBER), "0x", "0x01"],
          2,
          0,
        ],
      ],
    ]);
    expect(functionOf(logs)).toEqual({
      sighash: SELECTOR,
      executionOptions: "DelegateCall",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.STATIC,
          comparison: ParamComparison.GREATER_THAN,
          comparisonValue: [pad(MEMBER)],
        },
        {
          index: 2,
          type: ParameterType.DYNAMIC32,
          comparison: ParamComparison.ONE_OF,
          comparisonValue: ["0x01"],
        },
      ],
    });
  });

  it("overwrites one parameter at a time and clears the wildcard when it does", () => {
    const logs = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeAllowFunction", [1, TARGET, SELECTOR, 1, 0]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 1, 1, 2, "0xabcd", 0]],
      ["ScopeParameterAsOneOf", [1, TARGET, SELECTOR, 0, 0, [pad(MEMBER), pad(TARGET)], 0]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 1, 0, 0, pad(OTHER_TARGET), 0]],
    ]);
    expect(functionOf(logs)).toEqual({
      sighash: SELECTOR,
      // scopeAllowFunction's options survive: scopeParameter repacks around them.
      executionOptions: "Send",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.STATIC,
          comparison: ParamComparison.ONE_OF,
          comparisonValue: [pad(MEMBER), pad(TARGET)],
        },
        {
          index: 1,
          type: ParameterType.STATIC,
          comparison: ParamComparison.EQUAL_TO,
          comparisonValue: [pad(OTHER_TARGET)],
        },
      ],
    });
  });

  it("drops parameters on unscope, on wildcarding and on a function revoke", () => {
    const unscoped = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 0, 0, 0, pad(MEMBER), 0]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 1, 0, 0, pad(TARGET), 0]],
      ["UnscopeParameter", [1, TARGET, SELECTOR, 0, 0]],
    ]);
    expect(functionOf(unscoped).parameters.map((param) => param.index)).toEqual([1]);
    expect(functionOf(unscoped).wildcarded).toBe(false);

    // scopeAllowFunction packs a fresh config: nothing scoped survives it.
    const wildcarded = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 0, 0, 0, pad(MEMBER), 0]],
      ["ScopeAllowFunction", [1, TARGET, SELECTOR, 0, 0]],
    ]);
    expect(functionOf(wildcarded)).toEqual({
      sighash: SELECTOR,
      executionOptions: "None",
      wildcarded: true,
      parameters: [],
    });

    // A revoked function is gone, parameters included; re-scoping the same
    // selector starts clean rather than resurrecting them.
    const revoked = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 0, 0, 0, pad(MEMBER), 0]],
      ["ScopeRevokeFunction", [1, TARGET, SELECTOR, 0]],
    ]);
    expect(targetOf(revoked).functions).toEqual([]);
    const rescoped = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["ScopeParameter", [1, TARGET, SELECTOR, 0, 0, 0, pad(MEMBER), 0]],
      ["ScopeRevokeFunction", [1, TARGET, SELECTOR, 0]],
      ["ScopeFunctionExecutionOptions", [1, TARGET, SELECTOR, 1, 0]],
    ]);
    expect(functionOf(rescoped)).toEqual({
      sighash: SELECTOR,
      executionOptions: "Send",
      wildcarded: false,
      parameters: [],
    });
  });

  it("orders by block and log index whatever order the logs arrive in", () => {
    const ordered = logsOf([
      ["ScopeTarget", [1, TARGET]],
      ["AllowTarget", [1, TARGET, 1]],
      ["RevokeTarget", [1, TARGET]],
      ["ScopeTarget", [1, TARGET]],
    ]);
    const shuffled = [ordered[2], ordered[3], ordered[0], ordered[1]];
    expect(reduceRolesV1Logs(shuffled, MODIFIER)).toEqual(
      reduceRolesV1Logs(ordered, MODIFIER),
    );
    expect(targetOf(shuffled).clearance).toBe(ConditionType.SCOPED);
  });

  it("sorts roles, targets and functions by id like the subgraph did", () => {
    const logs = logsOf([
      ["ScopeAllowFunction", [2, OTHER_TARGET, "0xffffffff", 0, 0]],
      ["ScopeAllowFunction", [1, OTHER_TARGET, "0x00000001", 0, 0]],
      ["ScopeAllowFunction", [1, TARGET, "0xffffffff", 0, 0]],
      ["ScopeAllowFunction", [1, TARGET, "0x00000001", 0, 0]],
    ]);
    const roles = reduceRolesV1Logs(logs, MODIFIER)!.roles;
    expect(roles.map((role) => role.name)).toEqual(["1", "2"]);
    expect(roles[0].targets.map((target) => target.address)).toEqual([
      TARGET.toLowerCase(),
      OTHER_TARGET.toLowerCase(),
    ]);
    expect(roles[0].targets[0].functions.map((func) => func.sighash)).toEqual([
      "0x00000001",
      "0xffffffff",
    ]);
  });
});

/**
 * The full log of the carrotfunding.io gTrade vault's Roles modifier on
 * Arbitrum (0x773Df41c…, 42 logs through block 408810455, read 2026-09-24
 * over eth_getLogs). It exercises a revoke, a parameter overwritten from
 * one-of to equal-to and back, and setup events before the target's own
 * scope — the shapes a real modifier produces.
 */
describe("reduceRolesV1Logs on the gCFT modifier's live log", () => {
  const FUND = "0x58ba86cf363de2bdbe57ad885b47f1b985ea9f31";
  const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
  const GTRADE = "0xff162c694eaa571f685030649814282ea457f169";
  const logs: IRolesV1Log[] = (gcftLogs as any[]).map((log) => ({
    topics: log.topics,
    data: log.data,
    blockNumber: parseInt(log.blockNumber, 16),
    logIndex: parseInt(log.logIndex, 16),
  }));
  const modifier = reduceRolesV1Logs(logs, MODIFIER)!;
  const role = modifier.roles[0];
  const target = (address: string) =>
    role.targets.find((candidate) => candidate.address === address)!;
  const func = (address: string, sighash: string) =>
    target(address).functions.find((candidate) => candidate.sighash === sighash)!;

  it("finds the one role with both curators as members", () => {
    expect(modifier.avatar).toBe("0xa6287941fd8f70194ec253722dff1519946f368f");
    expect(modifier.roles).toHaveLength(1);
    expect(role.name).toBe("1");
    expect(role.members.map((assignment) => assignment.member.address)).toEqual([
      "0x77f252b5a4c1192efe09fcd7f9934a39c62ec85e",
      "0x930739ab33e3a2b27a0b286cf15093bee21ef5cc",
    ]);
  });

  it("scopes the fund, USDC and the gTrade diamond", () => {
    expect(role.targets.map((candidate) => candidate.address)).toEqual([FUND, USDC, GTRADE]);
    for (const candidate of role.targets) {
      expect(candidate.clearance).toBe(ConditionType.SCOPED);
      expect(candidate.executionOptions).toBe("None");
    }
  });

  it("keeps the last parameter condition written for USDC transfer and approve", () => {
    expect(target(USDC).functions.map((candidate) => candidate.sighash)).toEqual([
      "0x095ea7b3",
      "0xa9059cbb",
    ]);
    // approve: one-of two spenders first, then narrowed to the diamond.
    expect(func(USDC, "0x095ea7b3")).toEqual({
      sighash: "0x095ea7b3",
      executionOptions: "None",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.STATIC,
          comparison: ParamComparison.EQUAL_TO,
          comparisonValue: [pad(GTRADE)],
        },
      ],
    });
    // transfer: equal-to the fund three times over, then widened to one-of.
    expect(func(USDC, "0xa9059cbb").parameters).toEqual([
      {
        index: 0,
        type: ParameterType.STATIC,
        comparison: ParamComparison.ONE_OF,
        comparisonValue: [pad(FUND), pad("0x77f252b5a4c1192efe09fcd7f9934a39c62ec85e")],
      },
    ]);
  });

  it("drops the revoked gTrade function and keeps the seven wildcarded ones", () => {
    expect(target(GTRADE).functions.map((candidate) => candidate.sighash)).toEqual([
      "0x0bce9aaa",
      "0x36ce736b",
      "0x5bfcc4f8",
      "0x85886333",
      "0xa4bb127e",
      "0xb5d9e9d0",
      "0xb6919540",
      "0xf401f2bb",
    ]);
    const wildcarded = target(GTRADE).functions.filter((candidate) => candidate.wildcarded);
    expect(wildcarded).toHaveLength(7);
    for (const candidate of wildcarded) {
      expect(candidate.executionOptions).toBe("Send");
      expect(candidate.parameters).toEqual([]);
    }
    expect(func(GTRADE, "0x5bfcc4f8")).toEqual({
      sighash: "0x5bfcc4f8",
      executionOptions: "None",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.STATIC,
          comparison: ParamComparison.EQUAL_TO,
          comparisonValue: [pad("0xa6287941fd8f70194ec253722dff1519946f368f")],
        },
      ],
    });
  });

  it("reads the fund's own scoped functions with their execution options", () => {
    expect(func(FUND, "0xa61f5814")).toMatchObject({
      executionOptions: "Send",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.STATIC,
          comparison: ParamComparison.EQUAL_TO,
          comparisonValue: [pad("0xf25af37e48ee46ede9489f80e73b9669915d8337")],
        },
      ],
    });
    expect(func(FUND, "0xec68ac8d")).toMatchObject({
      executionOptions: "None",
      wildcarded: false,
      parameters: [
        {
          index: 0,
          type: ParameterType.DYNAMIC,
          comparison: ParamComparison.EQUAL_TO,
          comparisonValue: [pad("0xb358913726f3bac8626f18a1b2c007f1a59c4ff4")],
        },
      ],
    });
  });
});
