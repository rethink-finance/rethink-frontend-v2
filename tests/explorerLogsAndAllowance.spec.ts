import { afterEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";

vi.mock("~/store/web3/web3.store", () => ({
  useWeb3Store: () => ({
    networkRpcUrls: () => ["https://rpc-a.test/"],
  }),
}));
vi.mock("~/store/account/account.store", () => ({
  useAccountStore: () => ({}),
}));
// useRuntimeConfig is a Nuxt auto-import; outside a Nuxt app it has no
// instance to read, so the explorer's key is handed in here.
vi.mock("#app/nuxt", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRuntimeConfig: () => ({ public: { ETHERSCAN_KEY: "test-key" } }),
}));

const { fetchExplorerLogs } = await import("../services/onchain/explorerLogs");
const { fetchRolesAllowance } = await import("../composables/permissions/useRoleExecution");

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);
const MODIFIER = "0x5Eb928db6224f41B421E050A3689F66B0698AB8E";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchExplorerLogs", () => {
  it("reads Etherscan's bare \"0x\" log index as 0, not NaN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "1",
              result: [
                { address: MODIFIER, topics: ["0x01"], data: "0x", blockNumber: "0x64", timeStamp: "0x1", logIndex: "0x" },
                { address: MODIFIER, topics: ["0x02"], data: "0x", blockNumber: "0x64", timeStamp: "0x1", logIndex: "0x1" },
              ],
            }),
        }),
      ),
    );

    const logs = await fetchExplorerLogs("0x3e7" as any, MODIFIER);
    expect(logs.map((log) => [log.blockNumber, log.logIndex])).toEqual([
      [100, 0],
      [100, 1],
    ]);
  });
});

describe("fetchRolesAllowance", () => {
  it("decodes the modifier's stored allowance", async () => {
    const key = ethers.encodeBytes32String("yieldToMultisig");
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            result: rolesInterface.encodeFunctionResult("allowances", [5n, 100n, 86400n, 42n, 1_700_000_000n]),
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchRolesAllowance("0x1" as any, MODIFIER, key)).toEqual({
      refill: 5n,
      maxRefill: 100n,
      period: 86400n,
      balance: 42n,
      timestamp: 1_700_000_000n,
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body.method).toBe("eth_call");
    expect(body.params[0].to).toBe(MODIFIER);
    expect(body.params[0].data).toBe(rolesInterface.encodeFunctionData("allowances", [key]));
  });

  it("throws when the modifier reverts, instead of reading a zero balance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ error: { code: 3, message: "execution reverted", data: "0x" } }),
        }),
      ),
    );

    await expect(
      fetchRolesAllowance("0x1" as any, MODIFIER, ethers.ZeroHash),
    ).rejects.toThrow();
  });
});
