import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import RolesFullV1 from "../assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import { GovernableFund } from "../assets/contracts/GovernableFund";

// The create flow's NAV step: which calls "allow the manager to keep
// updating NAV" sends, and when it sends none. The RPC is mocked at fetch, so
// what is asserted is the eth_call the app makes and what it does with the
// modifier's answer.
const WALLET = "0xE257160f654A2E3222a343FafC4a71AE45Be5d99";
const account = { activeAccountAddress: WALLET as string | undefined };
vi.mock("~/store/web3/web3.store", () => ({
  useWeb3Store: () => ({
    networkRpcUrls: () => ["https://rpc-a.test/", "https://rpc-b.test/"],
  }),
}));
vi.mock("~/store/account/account.store", () => ({
  useAccountStore: () => account,
}));

const { managerCanExecuteNavUpdate } = await import(
  "../composables/nav/managerNavPermission"
);
const { buildManagerNavPermissionCalls } = await import(
  "../composables/nav/navProposal"
);
const { RolesVersion } = await import("../types/enums/roles_version");

const v1 = new ethers.Interface((RolesFullV1 as any).abi);
const v2 = new ethers.Interface((RolesFullV2 as any).abi);
const fundIface = new ethers.Interface(GovernableFund.abi as any);

const CHAIN = "0x1" as any;
const FUND = "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4";
const EXECUTOR = "0x5FA5a70A3A143E3F7B8906cbc08CAd606E4622b3";
const MODIFIER = "0x89de956576ACc0a141Bef842A489C2C391382B81";
const MANAGER_KEY = ethers.encodeBytes32String("defaulManagerRole");

const MODULE_TRANSACTION_FAILED = ethers.id("ModuleTransactionFailed()").slice(0, 10);
const NO_MEMBERSHIP = ethers.id("NoMembership()").slice(0, 10);
const NOT_AUTHORIZED =
  ethers.id("NotAuthorized(address)").slice(0, 10) +
  WALLET.slice(2).toLowerCase().padStart(64, "0");
const conditionViolation = (status: number) =>
  ethers.id("ConditionViolation(uint8,bytes32)").slice(0, 10) +
  ethers.AbiCoder.defaultAbiCoder()
    .encode(["uint8", "bytes32"], [status, ethers.ZeroHash])
    .slice(2);

const answers = (body: unknown) =>
  vi.fn(() => Promise.resolve({ json: () => Promise.resolve(body) }));
const success = () =>
  answers({ jsonrpc: "2.0", id: 1, result: "0x" + "1".padStart(64, "0") });
const revert = (data: string) =>
  answers({
    jsonrpc: "2.0",
    id: 1,
    error: { code: 3, message: "execution reverted", data },
  });

const sentCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
  const request = JSON.parse(init.body);
  return { method: request.method, ...request.params[0] } as {
    method: string;
    from: string;
    to: string;
    data: string;
  };
};

beforeEach(() => {
  account.activeAccountAddress = WALLET;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("managerCanExecuteNavUpdate", () => {
  it("dry-runs executeNAVUpdate(navExecutor) through the V2 modifier, as the connected wallet, under the manager role", async () => {
    const fetchMock = success();
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V2),
    ).toBe(true);

    const call = sentCall(fetchMock);
    expect(call.method).toBe("eth_call");
    expect(call.from).toBe(WALLET);
    expect(call.to).toBe(MODIFIER);
    const exec = v2.parseTransaction({ data: call.data })!;
    expect(exec.name).toBe("execTransactionWithRole");
    expect(exec.args[0]).toBe(FUND);
    expect(exec.args[4]).toBe(MANAGER_KEY);
    expect(exec.args[5]).toBe(true); // shouldRevert
    const inner = fundIface.parseTransaction({ data: exec.args[2] })!;
    expect(inner.name).toBe("executeNAVUpdate");
    expect(inner.selector).toBe("0xa61f5814");
    expect(inner.args[0]).toBe(EXECUTOR);
  });

  it("uses the uint16 role and the V1 ABI on a V1 modifier", async () => {
    const fetchMock = success();
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V1),
    ).toBe(true);
    const exec = v1.parseTransaction({ data: sentCall(fetchMock).data })!;
    expect(exec.name).toBe("execTransactionWithRole");
    expect(Number(exec.args[4])).toBe(1);
  });

  it("counts a revert on the vault itself as held: the permission layer already passed", async () => {
    vi.stubGlobal("fetch", revert(MODULE_TRANSACTION_FAILED));
    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V2),
    ).toBe(true);
  });

  it.each([
    ["the target is not allowed", conditionViolation(2)],
    ["the function is not allowed", conditionViolation(3)],
    ["the executor pinned by the scope is another one", conditionViolation(7)],
    ["the wallet lost the role", NO_MEMBERSHIP],
    ["the wallet never held a role", NOT_AUTHORIZED],
    ["the modifier does not know the call (wrong generation)", "0x"],
  ])("answers false when %s", async (_label, data) => {
    vi.stubGlobal("fetch", revert(data));
    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V2),
    ).toBe(false);
  });

  it("answers false on a V1 denial", async () => {
    vi.stubGlobal("fetch", revert(ethers.id("FunctionNotAllowed()").slice(0, 10)));
    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V1),
    ).toBe(false);
  });

  it("answers false, without throwing, when no RPC answers or no wallet is connected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V2),
    ).toBe(false);

    const fetchMock = success();
    vi.stubGlobal("fetch", fetchMock);
    account.activeAccountAddress = undefined;
    expect(
      await managerCanExecuteNavUpdate(CHAIN, MODIFIER, FUND, EXECUTOR, RolesVersion.V2),
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the NAV step's manager permission calls, by modifier generation", () => {
  // The selectors the factory's submitPermissions reverted on when they were
  // sent to a Roles V2 modifier (tx 0x598b3edc…420d6a).
  const V1_SCOPE_FUNCTION = "0x33a0480c";
  const V1_SCOPE_TARGET = "0x5e826695";

  it("V2: bytes32 role key calls a V2 modifier dispatches, executor pinned", () => {
    const { calldatas } = buildManagerNavPermissionCalls(
      FUND,
      EXECUTOR,
      MODIFIER,
      RolesVersion.V2,
    );
    expect(calldatas.length).toBe(2);
    const selectors = calldatas.map((c: string) => c.slice(0, 10));
    expect(selectors).not.toContain(V1_SCOPE_FUNCTION);
    expect(selectors).not.toContain(V1_SCOPE_TARGET);

    const scopeFunction = v2.parseTransaction({ data: calldatas[0] })!;
    expect(scopeFunction.name).toBe("scopeFunction");
    expect(scopeFunction.args[0]).toBe(MANAGER_KEY);
    expect(scopeFunction.args[1]).toBe(FUND);
    expect(scopeFunction.args[2]).toBe("0xa61f5814");
    // [Calldata/Matches, Static/EqualTo navExecutor]
    const pinned = scopeFunction.args[3][1];
    expect(Number(pinned.operator)).toBe(16);
    expect(ethers.getAddress(ethers.dataSlice(pinned.compValue, 12))).toBe(EXECUTOR);

    const scopeTarget = v2.parseTransaction({ data: calldatas[1] })!;
    expect(scopeTarget.name).toBe("scopeTarget");
    expect(scopeTarget.args[0]).toBe(MANAGER_KEY);
    expect(scopeTarget.args[1]).toBe(FUND);
  });

  it("V1 keeps the uint16 calls", () => {
    const { calldatas } = buildManagerNavPermissionCalls(
      FUND,
      EXECUTOR,
      MODIFIER,
      RolesVersion.V1,
    );
    expect(calldatas.map((c: string) => c.slice(0, 10))).toEqual([
      V1_SCOPE_FUNCTION,
      V1_SCOPE_TARGET,
    ]);
    expect(v1.parseTransaction({ data: calldatas[0] })!.name).toBe("scopeFunction");
  });
});
