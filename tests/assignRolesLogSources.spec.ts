import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import RolesFullV1 from "../assets/contracts/zodiac/RolesFull.json";

// The three log tiers the membership readers fall through: explorer,
// Blockscout, then each RPC. Mocked at the module boundary so each test can
// decide which tier answers.
const explorer = vi.fn();
const blockscout = vi.fn();
vi.mock("~/services/onchain/explorerLogs", () => ({
  fetchExplorerLogs: (...args: unknown[]) => explorer(...args),
}));
vi.mock("~/services/onchain/roleScopes", () => ({
  fetchBlockscoutRoleLogs: (...args: unknown[]) => blockscout(...args),
}));
vi.mock("~/store/web3/web3.store", () => ({
  useWeb3Store: () => ({
    networkRpcUrls: () => ["https://rpc-a.test/", "https://rpc-b.test/"],
  }),
}));
vi.mock("~/store/account/account.store", () => ({
  useAccountStore: () => ({}),
}));

const { fetchMemberRoles, fetchRoleMembers } = await import(
  "../composables/permissions/useRoleExecution"
);
const { RolesVersion } = await import("../types/enums/roles_version");

const MOD = "0x89de956576ACc0a141Bef842A489C2C391382B81";
const ALEX = "0xE257160f654A2E3222a343FafC4a71AE45Be5d99";
const OTHER = "0x2023b43B9cFc2377EBb20886DcA2603D9D7C41B0";
const CHAIN = "0x2105" as any;

const iface = new ethers.Interface((RolesFullV1 as any).abi);
const assignTopic = iface.getEvent("AssignRoles")!.topicHash;

/** An AssignRoles(module, roles[], memberOf[]) log as any tier would hand it back. */
const assign = (
  member: string,
  roles: number[],
  memberOf: boolean[],
  blockNumber: number | string,
  logIndex: number | string = 0,
) => {
  const encoded = iface.encodeEventLog("AssignRoles", [member, roles, memberOf]);
  return { topics: encoded.topics, data: encoded.data, blockNumber, logIndex };
};

/** Some other event on the modifier, which the readers must ignore. */
const noise = (blockNumber: number) => ({
  topics: [ethers.id("ScopeTarget(uint16,address)")],
  data: "0x",
  blockNumber,
  logIndex: 0,
});

const rpcAnswer = (logs: unknown[] | Error) =>
  vi.fn(() =>
    Promise.resolve(
      logs instanceof Error
        ? { json: () => Promise.resolve({ error: { message: logs.message } }) }
        : { json: () => Promise.resolve({ result: logs }) },
    ),
  );

beforeEach(() => {
  explorer.mockReset();
  blockscout.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AssignRoles log sources", () => {
  it("takes the explorer's answer first and asks for the AssignRoles topic only", async () => {
    explorer.mockResolvedValue([assign(ALEX, [1], [true], 100)]);
    blockscout.mockRejectedValue(new Error("must not be called"));
    vi.stubGlobal("fetch", rpcAnswer(new Error("must not be called")));

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual(["1"]);
    expect(explorer).toHaveBeenCalledWith(CHAIN, MOD, assignTopic);
    expect(blockscout).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls through to Blockscout when the explorer has no plan for the chain, sorting its newest-first log and dropping other events", async () => {
    explorer.mockRejectedValue(new Error("No block explorer could serve chain 0x2105"));
    // Blockscout pages newest first and returns every event of the modifier.
    blockscout.mockResolvedValue([
      noise(300),
      assign(ALEX, [1], [false], 200), // revoked...
      assign(ALEX, [1], [true], 250), // ...then re-assigned: the later one wins
      assign(OTHER, [1, 2], [true, true], 150),
      assign(ALEX, [1], [true], 100),
    ]);
    vi.stubGlobal("fetch", rpcAnswer(new Error("must not be called")));

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual(["1"]);
    expect(new Set(await fetchRoleMembers(CHAIN, MOD, "1", RolesVersion.V1))).toEqual(
      new Set([ALEX, OTHER]),
    );
    expect(await fetchRoleMembers(CHAIN, MOD, "2", RolesVersion.V1)).toEqual([OTHER]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps replay order when the Blockscout log is newest first and a later revoke wins", async () => {
    explorer.mockRejectedValue(new Error("no explorer"));
    blockscout.mockResolvedValue([
      assign(ALEX, [1], [false], 250),
      assign(ALEX, [1], [true], 100),
    ]);
    vi.stubGlobal("fetch", rpcAnswer(new Error("must not be called")));

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual([]);
  });

  it("uses the RPCs, in order, when neither explorer answers", async () => {
    explorer.mockRejectedValue(new Error("no explorer"));
    blockscout.mockRejectedValue(new Error("Blockscout returned 500"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ error: { message: "block range too large" } }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            result: [assign(ALEX, [1], [true], "0x64", "0x0")],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual(["1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://rpc-a.test/");
    expect(fetchMock.mock.calls[1][0]).toBe("https://rpc-b.test/");
  });

  it("prefers a tier with data over an earlier tier that answered empty", async () => {
    explorer.mockResolvedValue([]);
    blockscout.mockResolvedValue([assign(ALEX, [1], [true], 100)]);
    vi.stubGlobal("fetch", rpcAnswer(new Error("must not be called")));

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual(["1"]);
  });

  it("returns an empty membership only when a tier answered and none had data", async () => {
    explorer.mockResolvedValue([]);
    blockscout.mockRejectedValue(new Error("Blockscout returned 500"));
    vi.stubGlobal("fetch", rpcAnswer(new Error("block range too large")));

    expect(await fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).toEqual([]);
  });

  it("throws when every tier fails, so a failed read never reads as no membership", async () => {
    explorer.mockRejectedValue(new Error("no explorer"));
    blockscout.mockRejectedValue(new Error("Blockscout returned 500"));
    vi.stubGlobal("fetch", rpcAnswer(new Error("block range too large")));

    await expect(fetchMemberRoles(CHAIN, MOD, ALEX, RolesVersion.V1)).rejects.toThrow(
      "block range too large",
    );
  });
});
