import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  reduceRoleScopeLogs,
  type IRoleScopeLog,
} from "../services/onchain/roleScopes";
import {
  listLiveRoleKeys,
  storedRolePermissionCalls,
} from "../composables/permissions/roleScopeLogs";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const ROLE_KEY = ethers.encodeBytes32String("defaulManagerRole");
const OTHER_ROLE_KEY = ethers.encodeBytes32String("someOtherRole");
const T1 = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const T2 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const S1 = "0x617ba037";
const S2 = "0x095ea7b3";

/** Encode one modifier event as the raw log shape the reducer takes. */
const log = (
  blockNumber: number,
  logIndex: number,
  name: string,
  args: unknown[],
): IRoleScopeLog => {
  const encoded = rolesInterface.encodeEventLog(
    rolesInterface.getEvent(name)!,
    args,
  );
  return { topics: encoded.topics, data: encoded.data, blockNumber, logIndex };
};

describe("reduceRoleScopeLogs", () => {
  it("folds scope and revoke events into the role's current grants", () => {
    const state = reduceRoleScopeLogs(
      [
        log(10, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(10, 1, "ScopeFunction", [ROLE_KEY, T1, S1, [], 0]),
        log(10, 2, "AllowFunction", [ROLE_KEY, T1, S2, 0]),
        log(11, 0, "RevokeFunction", [ROLE_KEY, T1, S2]),
      ],
      ROLE_KEY,
    );
    expect(state.scopes).toEqual([{ target: T1, selector: S1 }]);
    expect(state.targets).toEqual([T1]);
    expect(state.latestBlock).toBe(11);
  });

  it("keeps stored function grants across a RevokeTarget, as the contract does", () => {
    // revokeTarget only drops the clearance; the scoped function survives in
    // storage and would come back to life on a later scopeTarget, so an
    // authoritative save must still see — and explicitly revoke — it.
    const state = reduceRoleScopeLogs(
      [
        log(1, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(1, 1, "ScopeFunction", [ROLE_KEY, T1, S1, [], 0]),
        log(2, 0, "RevokeTarget", [ROLE_KEY, T1]),
      ],
      ROLE_KEY,
    );
    expect(state.targets).toEqual([]);
    expect(state.scopes).toEqual([{ target: T1, selector: S1 }]);
  });

  it("tracks wildcard-allowed targets with no function grants", () => {
    const state = reduceRoleScopeLogs(
      [log(5, 0, "AllowTarget", [ROLE_KEY, T2, 0])],
      ROLE_KEY,
    );
    expect(state.targets).toEqual([T2]);
    expect(state.scopes).toEqual([]);
  });

  it("ignores other roles' grants but still counts their blocks as read", () => {
    // The freshness floor compares against latestBlock, and a save on any
    // role proves how far the log source has indexed.
    const state = reduceRoleScopeLogs(
      [log(42, 0, "ScopeFunction", [OTHER_ROLE_KEY, T1, S1, [], 0])],
      ROLE_KEY,
    );
    expect(state.scopes).toEqual([]);
    expect(state.targets).toEqual([]);
    expect(state.latestBlock).toBe(42);
  });

  it("replays out-of-order input in (block, logIndex) order", () => {
    // Explorer pages guarantee block order but not intra-block order; a
    // revoke folded before its grant would resurrect the grant.
    const state = reduceRoleScopeLogs(
      [
        log(3, 0, "RevokeFunction", [ROLE_KEY, T1, S1]),
        log(2, 1, "ScopeFunction", [ROLE_KEY, T1, S1, [], 0]),
        log(2, 0, "ScopeTarget", [ROLE_KEY, T1]),
      ],
      ROLE_KEY,
    );
    expect(state.scopes).toEqual([]);
    expect(state.targets).toEqual([T1]);
  });

  it("skips events that do not move grants", () => {
    const assign = rolesInterface.encodeEventLog(
      rolesInterface.getEvent("AssignRoles")!,
      [T1, [ROLE_KEY], [true]],
    );
    const state = reduceRoleScopeLogs(
      [
        {
          topics: assign.topics,
          data: assign.data,
          blockNumber: 99,
          logIndex: 0,
        },
      ],
      ROLE_KEY,
    );
    expect(state.scopes).toEqual([]);
    expect(state.targets).toEqual([]);
    // Not a permission event, so it proves nothing about scope freshness.
    expect(state.latestBlock).toBe(0);
  });
});

describe("storedRolePermissionCalls", () => {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const CONDITIONS = [
    [0, 5, 5, "0x"],
    [0, 1, 16, abi.encode(["address"], [T1])],
  ];
  const decode = (calls: string[]) =>
    calls.map((data) => {
      const tx = rolesInterface.parseTransaction({ data })!;
      return [tx.name, ...tx.args.slice(0, 3).map(String)];
    });

  it("writes what the role is granted back out as the calls that grant it", () => {
    const calls = storedRolePermissionCalls(
      [
        log(1, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(1, 1, "ScopeFunction", [ROLE_KEY, T1, S1, CONDITIONS, 0]),
        log(1, 2, "AllowFunction", [ROLE_KEY, T1, S2, 1]),
        log(2, 0, "ScopeTarget", [ROLE_KEY, T2]),
        log(2, 1, "ScopeTarget", [OTHER_ROLE_KEY, T2]),
        log(2, 2, "AllowFunction", [OTHER_ROLE_KEY, T2, S1, 0]),
      ],
      ROLE_KEY,
    );
    expect(decode(calls)).toEqual([
      ["scopeTarget", ROLE_KEY, T1],
      ["scopeFunction", ROLE_KEY, T1, S1],
      ["allowFunction", ROLE_KEY, T1, S2],
      ["scopeTarget", ROLE_KEY, T2],
    ]);
    // The stored conditions and options come back exactly.
    const scoped = rolesInterface.parseTransaction({ data: calls[1] })!;
    expect(scoped.args[3].map((c: any) => [Number(c[0]), Number(c[1]), Number(c[2]), c[3]])).toEqual(CONDITIONS);
    expect(Number(scoped.args[4])).toBe(0);
    const allowed = rolesInterface.parseTransaction({ data: calls[2] })!;
    expect(Number(allowed.args[3])).toBe(1);
  });

  it("lists only what is in effect", () => {
    const calls = storedRolePermissionCalls(
      [
        // Revoked function, then a contract closed with a function still stored.
        log(1, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(1, 1, "AllowFunction", [ROLE_KEY, T1, S1, 0]),
        log(1, 2, "AllowFunction", [ROLE_KEY, T1, S2, 0]),
        log(2, 0, "RevokeFunction", [ROLE_KEY, T1, S2]),
        log(3, 0, "ScopeTarget", [ROLE_KEY, T2]),
        log(3, 1, "AllowFunction", [ROLE_KEY, T2, S1, 0]),
        log(4, 0, "RevokeTarget", [ROLE_KEY, T2]),
      ],
      ROLE_KEY,
    );
    expect(decode(calls)).toEqual([
      ["scopeTarget", ROLE_KEY, T1],
      ["allowFunction", ROLE_KEY, T1, S1],
    ]);
  });

  it("shows a wholesale-allowed contract as that, without its function grants", () => {
    const calls = storedRolePermissionCalls(
      [
        log(1, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(1, 1, "AllowFunction", [ROLE_KEY, T1, S1, 0]),
        log(2, 0, "AllowTarget", [ROLE_KEY, T1, 3]),
      ],
      ROLE_KEY,
    );
    expect(decode(calls)).toEqual([["allowTarget", ROLE_KEY, T1, "3"]]);
    // …and a later scopeTarget narrows it again, bringing the function back.
    const narrowed = storedRolePermissionCalls(
      [
        log(1, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(1, 1, "AllowFunction", [ROLE_KEY, T1, S1, 0]),
        log(2, 0, "AllowTarget", [ROLE_KEY, T1, 3]),
        log(3, 0, "ScopeTarget", [ROLE_KEY, T1]),
      ],
      ROLE_KEY,
    );
    expect(decode(narrowed)).toEqual([
      ["scopeTarget", ROLE_KEY, T1],
      ["allowFunction", ROLE_KEY, T1, S1],
    ]);
  });

  it("is empty for a role nothing was ever granted to", () => {
    expect(storedRolePermissionCalls([log(1, 0, "ScopeTarget", [OTHER_ROLE_KEY, T1])], ROLE_KEY)).toEqual([]);
  });
});

describe("listLiveRoleKeys", () => {
  const MEMBER = "0x1111111111111111111111111111111111111111";
  const lower = (key: string) => key.toLowerCase();

  it("lists a role once someone holds it or it is granted something", () => {
    expect(
      listLiveRoleKeys([
        log(10, 0, "AssignRoles", [MEMBER, [ROLE_KEY], [true]]),
        log(11, 0, "ScopeTarget", [OTHER_ROLE_KEY, T1]),
      ]),
    ).toEqual([lower(ROLE_KEY), lower(OTHER_ROLE_KEY)]);
  });

  it("drops a role whose members and grants are all gone", () => {
    expect(
      listLiveRoleKeys([
        log(10, 0, "AssignRoles", [MEMBER, [ROLE_KEY, OTHER_ROLE_KEY], [true, true]]),
        log(11, 0, "ScopeTarget", [OTHER_ROLE_KEY, T1]),
        log(12, 0, "AssignRoles", [MEMBER, [ROLE_KEY, OTHER_ROLE_KEY], [false, false]]),
      ]),
    ).toEqual([lower(OTHER_ROLE_KEY)]);
    expect(
      listLiveRoleKeys([
        log(10, 0, "ScopeTarget", [ROLE_KEY, T1]),
        log(11, 0, "RevokeTarget", [ROLE_KEY, T1]),
      ]),
    ).toEqual([]);
  });

  it("replays out of order, and is empty for a modifier nothing happened on", () => {
    expect(listLiveRoleKeys([])).toEqual([]);
    expect(
      listLiveRoleKeys([
        log(12, 0, "AssignRoles", [MEMBER, [ROLE_KEY], [false]]),
        log(10, 0, "AssignRoles", [MEMBER, [ROLE_KEY], [true]]),
      ]),
    ).toEqual([]);
  });
});
