import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import RolesFullV1 from "../assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  buildReturnRevokeEntries,
  buildReturnTestFundsCalls,
  encodeReturnRoleProbe,
  encodeSubmitPermissions,
  isReturnRoleClosed,
  RETURN_ROLE_ID_V1,
  RETURN_ROLE_KEY_V2,
  type IReturnTestFundsParams,
} from "../composables/onboarding/returnTestFundsCalls";

const FACTORY = "0x0F46b4A1B4C794fc078A87A8118dB47ab76B25A7";
const ROLES = "0x8a1002ce755ef19a5cdbCaeA41071b5C6335B526";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const DEPLOYER = "0x000000000000000000000000000000000000bEEF";
const AMOUNT = ethers.parseEther("0.25");

const factoryIface = new ethers.Interface([
  "function submitPermissions(bytes[] calldatas)",
]);
const rolesV1 = new ethers.Interface((RolesFullV1 as any).abi);
const rolesV2 = new ethers.Interface((RolesFullV2 as any).abi);
const erc20 = new ethers.Interface(["function transfer(address,uint256)"]);
const coder = ethers.AbiCoder.defaultAbiCoder();

const params = (version: "V1" | "V2"): IReturnTestFundsParams => ({
  version,
  factoryAddress: FACTORY,
  rolesModAddress: ROLES,
  tokenAddress: WETH,
  member: DEPLOYER,
  recipient: DEPLOYER,
  amount: AMOUNT,
});

/** A batch call's calldata; every call of the return carries some. */
const dataOf = (call: { data?: string }): string => {
  if (!call.data) throw new Error("The call has no calldata.");
  return call.data;
};

/** The Roles admin calls inside one submitPermissions, decoded. */
const submitted = (data: string, iface: ethers.Interface) =>
  (factoryIface.decodeFunctionData("submitPermissions", data)[0] as string[]).map(
    (entry) => iface.parseTransaction({ data: entry })!,
  );

describe("buildReturnTestFundsCalls (Roles V2)", () => {
  const calls = buildReturnTestFundsCalls(params("V2"));
  const key = ethers.encodeBytes32String(RETURN_ROLE_KEY_V2);

  it("is grant, transfer, revoke — factory, modifier, factory", () => {
    expect(calls.map((call) => call.to)).toEqual([FACTORY, ROLES, FACTORY]);
  });

  it("grants a throwaway role, never the curator's", () => {
    const grant = submitted(dataOf(calls[0]), rolesV2);
    expect(grant.map((tx) => tx.name)).toEqual([
      "assignRoles",
      "scopeTarget",
      "scopeFunction",
    ]);
    expect(grant[0].args[0]).toBe(DEPLOYER);
    expect(grant[0].args[1]).toEqual([key]);
    expect(grant[0].args[2]).toEqual([true]);
    for (const tx of grant.slice(1)) expect(tx.args[0]).toBe(key);
  });

  it("pins both transfer arguments to exactly this return", () => {
    const scope = submitted(dataOf(calls[0]), rolesV2)[2];
    expect(scope.args[1]).toBe(WETH);
    expect(scope.args[2]).toBe("0xa9059cbb");
    const conditions = scope.args[3].map((c: any) => [
      Number(c[0]),
      Number(c[1]),
      Number(c[2]),
      c[3],
    ]);
    expect(conditions).toEqual([
      [0, 5, 5, "0x"], // Calldata Matches
      [0, 1, 16, coder.encode(["address"], [DEPLOYER])], // to == recipient
      [0, 1, 16, coder.encode(["uint256"], [AMOUNT])], // amount == amount
    ]);
    expect(Number(scope.args[4])).toBe(0); // no send / delegatecall
  });

  it("executes the transfer under the throwaway role, reverting on failure", () => {
    const exec = rolesV2.parseTransaction({ data: dataOf(calls[1]) })!;
    expect(exec.name).toBe("execTransactionWithRole");
    expect(exec.args[0]).toBe(WETH);
    expect(exec.args[1]).toBe(0n);
    expect(exec.args[2]).toBe(erc20.encodeFunctionData("transfer", [DEPLOYER, AMOUNT]));
    expect(Number(exec.args[3])).toBe(0);
    expect(exec.args[4]).toBe(key);
    expect(exec.args[5]).toBe(true);
  });

  it("tears the role down completely", () => {
    const revoke = submitted(dataOf(calls[2]), rolesV2);
    expect(revoke.map((tx) => tx.name)).toEqual([
      "revokeFunction",
      "revokeTarget",
      "assignRoles",
    ]);
    expect(revoke[0].args.slice(0, 3)).toEqual([key, WETH, "0xa9059cbb"]);
    expect(revoke[1].args.slice(0, 2)).toEqual([key, WETH]);
    expect(revoke[2].args[2]).toEqual([false]);
  });
});

describe("buildReturnTestFundsCalls (Roles V1)", () => {
  const calls = buildReturnTestFundsCalls(params("V1"));

  it("uses the reserved V1 role id throughout", () => {
    const grant = submitted(dataOf(calls[0]), rolesV1);
    expect(grant.map((tx) => tx.name)).toEqual([
      "assignRoles",
      "scopeTarget",
      "scopeParameter",
      "scopeParameter",
    ]);
    expect(grant[0].args[1].map(Number)).toEqual([RETURN_ROLE_ID_V1]);
    for (const tx of grant.slice(1)) expect(Number(tx.args[0])).toBe(RETURN_ROLE_ID_V1);

    const exec = rolesV1.parseTransaction({ data: dataOf(calls[1]) })!;
    expect(Number(exec.args[4])).toBe(RETURN_ROLE_ID_V1);
    expect(exec.args[5]).toBe(true);

    const revoke = submitted(dataOf(calls[2]), rolesV1);
    expect(revoke.map((tx) => tx.name)).toEqual([
      "scopeRevokeFunction",
      "revokeTarget",
      "assignRoles",
    ]);
    expect(revoke[2].args[2]).toEqual([false]);
  });

  it("pins recipient (param 0) and amount (param 1) as static equalities", () => {
    const [, , to, amount] = submitted(dataOf(calls[0]), rolesV1);
    expect([Number(to.args[3]), Number(to.args[4]), Number(to.args[5])]).toEqual([0, 0, 0]);
    expect(to.args[6]).toBe(coder.encode(["address"], [DEPLOYER]));
    expect([Number(amount.args[3]), Number(amount.args[4]), Number(amount.args[5])]).toEqual([1, 0, 0]);
    expect(amount.args[6]).toBe(coder.encode(["uint256"], [AMOUNT]));
  });
});

describe("open-role cleanup", () => {
  it("the standalone revoke is the batch's last call, whatever the amount", () => {
    for (const version of ["V1", "V2"] as const) {
      const calls = buildReturnTestFundsCalls({ ...params(version), amount: 123n });
      expect(
        encodeSubmitPermissions(
          buildReturnRevokeEntries({ version, tokenAddress: WETH, member: DEPLOYER }),
        ),
      ).toBe(dataOf(calls[2]));
    }
  });

  it("probes with a zero transfer to the member under the throwaway role", () => {
    const exec = rolesV2.parseTransaction({
      data: encodeReturnRoleProbe({ version: "V2", tokenAddress: WETH, member: DEPLOYER }),
    })!;
    expect(exec.args[2]).toBe(erc20.encodeFunctionData("transfer", [DEPLOYER, 0n]));
    expect(exec.args[4]).toBe(ethers.encodeBytes32String(RETURN_ROLE_KEY_V2));
  });

  // Revert payloads as the fork returned them.
  const NO_MEMBERSHIP = "0xfd8e9f28";
  // NotAuthorized(address), as a mainnet V2 modifier answers a wallet that
  // is not one of its modules.
  const NOT_AUTHORIZED =
    "0x4a0bfec1" + coder.encode(["address"], [DEPLOYER]).slice(2);
  const MODULE_NOT_AUTHORIZED =
    "0x08c379a0" + coder.encode(["string"], ["Module not authorized"]).slice(2);
  const CONDITION_VIOLATION =
    "0xd0a9bf58" +
    "0000000000000000000000000000000000000000000000000000000000000007" +
    "0000000000000000000000000000000000000000000000000000000000000000";
  const V1_PARAMETER_NOT_ALLOWED = "0x31e98246";

  it("reads a refused sender as closed", () => {
    expect(isReturnRoleClosed(true, NO_MEMBERSHIP)).toBe(true);
    expect(isReturnRoleClosed(true, MODULE_NOT_AUTHORIZED)).toBe(true);
    expect(isReturnRoleClosed(true, NOT_AUTHORIZED)).toBe(true);
  });

  it("reads anything past the membership check as open", () => {
    expect(isReturnRoleClosed(true, CONDITION_VIOLATION)).toBe(false);
    expect(isReturnRoleClosed(true, V1_PARAMETER_NOT_ALLOWED)).toBe(false);
    expect(isReturnRoleClosed(false, "0x")).toBe(false);
    const otherString = "0x08c379a0" + coder.encode(["string"], ["Something else"]).slice(2);
    expect(isReturnRoleClosed(true, otherString)).toBe(false);
  });
});
