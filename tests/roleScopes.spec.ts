import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  reduceRoleScopeLogs,
  type IRoleScopeLog,
} from "../services/onchain/roleScopes";

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
