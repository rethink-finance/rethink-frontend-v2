import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import RolesFullV1 from "../assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  GOVERNOR_EXECUTE_OVERHEAD,
  checkRolesCallVersions,
  summarizeProposalPreflight,
  toProposalCalls,
} from "../composables/governance/proposalPreflightCore";
import {
  generateNAVPermission,
  generateNAVPermissionRolesV2,
  toRoleKeyBytes32,
} from "../composables/nav/generateNAVPermission";
import {
  buildManagerNavPermissionCalls,
  encodeStoreNAVData,
  getNavMethodsProposalData,
} from "../composables/nav/navProposal";
import { pickManagerRole } from "../composables/permissions/managerRole";
import {
  SAFE_EXEC_TRANSACTION_SELECTOR,
  SAFE_IFACE,
  decodeSafeControl,
  prevalidatedSignature,
  wrapProposalThroughSafe,
} from "../composables/governance/safeExecution";
import { prepPermissionsProposalData } from "../types/enums/delegated_permission";
import { RolesVersion } from "../types/enums/roles_version";

const v1 = new ethers.Interface((RolesFullV1 as any).abi);
const v2 = new ethers.Interface((RolesFullV2 as any).abi);

const FUND = "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4";
const EXECUTOR = "0x5FA5a70A3A143E3F7B8906cbc08CAd606E4622b3";
const MODIFIER = "0x89de956576ACc0a141Bef842A489C2C391382B81";
const EXECUTE_NAV_UPDATE = "0xa61f5814";
const UPDATE_NAV_CALLDATA = "0x93a1de3f" + "00".repeat(64);

describe("Roles-version-aware NAV permissions", () => {
  it("V1: scopeFunction/scopeTarget carry the manager's real role, not a hardcoded 1", () => {
    const { targets, calldatas } = buildManagerNavPermissionCalls(
      FUND,
      EXECUTOR,
      MODIFIER,
      RolesVersion.V1,
      "3",
    );
    expect(targets).toEqual([MODIFIER, MODIFIER]);

    const scopeFunction = v1.parseTransaction({ data: calldatas[0] })!;
    expect(scopeFunction.name).toBe("scopeFunction");
    expect(Number(scopeFunction.args[0])).toBe(3);
    expect(scopeFunction.args[1].toLowerCase()).toBe(FUND.toLowerCase());
    expect(scopeFunction.args[2]).toBe(EXECUTE_NAV_UPDATE);
    // the navExecutor parameter is pinned
    expect(scopeFunction.args[6][0].toLowerCase()).toContain(EXECUTOR.slice(2).toLowerCase());

    const scopeTarget = v1.parseTransaction({ data: calldatas[1] })!;
    expect(scopeTarget.name).toBe("scopeTarget");
    expect(Number(scopeTarget.args[0])).toBe(3);
    expect(scopeTarget.args[1].toLowerCase()).toBe(FUND.toLowerCase());
  });

  it("V1 default role stays 1 when none is given (previous behaviour)", () => {
    const entries = generateNAVPermission(FUND, EXECUTOR);
    expect(entries[0].value[0].data).toBe("1");
    expect(entries[1].value[0].data).toBe("1");
  });

  it("V2: the same intent encodes with bytes32 role keys the V2 modifier dispatches", () => {
    const { targets, calldatas } = buildManagerNavPermissionCalls(
      FUND,
      EXECUTOR,
      MODIFIER,
      RolesVersion.V2,
    );
    expect(targets).toEqual([MODIFIER, MODIFIER]);
    expect(calldatas).toEqual(generateNAVPermissionRolesV2(FUND, EXECUTOR));
    expect(calldatas[0].slice(0, 10)).toBe("0x7508dd98"); // scopeFunction(bytes32,...)
    expect(calldatas[1].slice(0, 10)).toBe("0x0c6c76b8"); // scopeTarget(bytes32,address)
    // and a V1 modifier would not know either selector
    expect(v1.getFunction("0x7508dd98")).toBeNull();
    expect(v1.getFunction("0x0c6c76b8")).toBeNull();
  });

  it("V2 accepts a role key read back off chain (already bytes32) without re-encoding it", () => {
    const onChainKey = ethers.encodeBytes32String("customRole");
    expect(toRoleKeyBytes32(onChainKey)).toBe(onChainKey);
    expect(toRoleKeyBytes32("customRole")).toBe(onChainKey);

    const { calldatas } = buildManagerNavPermissionCalls(
      FUND,
      EXECUTOR,
      MODIFIER,
      RolesVersion.V2,
      onChainKey,
    );
    const scopeTarget = v2.parseTransaction({ data: calldatas[1] })!;
    expect(scopeTarget.args[0]).toBe(onChainKey);
  });
});

describe("NAV methods proposal carries the executor copy", () => {
  it("adds storeNAVData with the identical updateNav calldata right after updateNav", () => {
    const data = getNavMethodsProposalData(
      UPDATE_NAV_CALLDATA,
      FUND,
      true,
      false,
      true,
      EXECUTOR,
    );
    expect(data.targets).toEqual([FUND, EXECUTOR, FUND, FUND]);
    expect(data.calldatas[0]).toBe(UPDATE_NAV_CALLDATA);
    expect(data.calldatas[1]).toBe(encodeStoreNAVData(FUND, UPDATE_NAV_CALLDATA));
    expect(data.calldatas[1].slice(0, 10)).toBe("0xc8361853"); // storeNAVData(address,bytes)
    const [fund, stored] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "bytes"],
      "0x" + data.calldatas[1].slice(10),
    );
    expect(fund.toLowerCase()).toBe(FUND.toLowerCase());
    expect(stored).toBe(UPDATE_NAV_CALLDATA);
  });

  it("leaves the shape unchanged when no executor address is given", () => {
    const data = getNavMethodsProposalData(UPDATE_NAV_CALLDATA, FUND, true, true, true);
    expect(data.targets).toEqual([FUND, FUND, FUND, FUND]);
    expect(data.calldatas.map((c: string) => c.slice(0, 10))).toEqual([
      "0x93a1de3f",
      "0xe9ae21ea",
      "0xe9ae21ea",
      "0xe9ae21ea",
    ]);
  });
});

describe("Delegated permissions encode with the deployed modifier's ABI", () => {
  const scopeTargetForm = {
    contractMethod: "scopeTarget",
    role: "1",
    roleKey: ethers.encodeBytes32String("defaulManagerRole"),
    targetAddress: FUND,
  };

  it("V1 form → uint16 selector", () => {
    const { encodedRoleModEntries, targets } = prepPermissionsProposalData(
      MODIFIER,
      [scopeTargetForm],
      RolesVersion.V1,
    );
    expect(targets).toEqual([MODIFIER]);
    expect(v1.parseTransaction({ data: encodedRoleModEntries[0] })!.name).toBe("scopeTarget");
    expect(encodedRoleModEntries[0].slice(0, 10)).toBe(
      v1.getFunction("scopeTarget")!.selector,
    );
  });

  it("V2 form → bytes32 selector", () => {
    const { encodedRoleModEntries } = prepPermissionsProposalData(
      MODIFIER,
      [scopeTargetForm],
      RolesVersion.V2,
    );
    expect(encodedRoleModEntries[0].slice(0, 10)).toBe("0x0c6c76b8");
    const parsed = v2.parseTransaction({ data: encodedRoleModEntries[0] })!;
    expect(parsed.args[0]).toBe(scopeTargetForm.roleKey);
  });

  it("refuses a function the deployed generation does not have", () => {
    expect(() =>
      prepPermissionsProposalData(
        MODIFIER,
        [{ contractMethod: "scopeAllowFunction" }],
        RolesVersion.V2,
      ),
    ).toThrow(/does not exist on a Roles V2 modifier \(it is a Roles V1 function\)/);
  });
});

describe("Actions routed through the Safe (settings.governor == Safe)", () => {
  const SAFE = "0x30Fe6826a683B154703BbcAD1BCCAa1D32B0F674";
  const GOVERNOR = "0xC44711C4C4DA6B94e9079f8a24203b1904303826";

  it("pre-validated signature is r = governor, s = 0, v = 1", () => {
    const sig = prevalidatedSignature(GOVERNOR);
    expect(sig.length).toBe(2 + 65 * 2);
    expect(sig.slice(2, 66)).toBe("000000000000000000000000" + GOVERNOR.slice(2).toLowerCase());
    expect(sig.slice(66, 130)).toBe("0".repeat(64));
    expect(sig.slice(130)).toBe("01");
  });

  it("wraps every action into Safe.execTransaction on the governor's behalf", () => {
    const wrapped = wrapProposalThroughSafe(
      { targets: [FUND, EXECUTOR], gasValues: [0, 0], calldatas: [UPDATE_NAV_CALLDATA, "0xc8361853"] },
      SAFE,
      GOVERNOR,
    );
    expect(wrapped.targets).toEqual([SAFE, SAFE]);
    expect(wrapped.calldatas.every((c: string) => c.startsWith(SAFE_EXEC_TRANSACTION_SELECTOR))).toBe(true);
    const inner = SAFE_IFACE.parseTransaction({ data: wrapped.calldatas[0] })!;
    expect(inner.args.to.toLowerCase()).toBe(FUND.toLowerCase());
    expect(inner.args.data).toBe(UPDATE_NAV_CALLDATA);
    expect(Number(inner.args.operation)).toBe(0);
    expect(inner.args.signatures).toBe(prevalidatedSignature(GOVERNOR));
  });

  it("can leave chosen targets direct", () => {
    const wrapped = wrapProposalThroughSafe(
      { targets: [FUND, FUND], gasValues: [0, 0], calldatas: [UPDATE_NAV_CALLDATA, "0xe9ae21ea"] },
      SAFE,
      GOVERNOR,
      (_t, i) => i === 0,
    );
    expect(wrapped.targets).toEqual([SAFE, FUND]);
    expect(wrapped.calldatas[1]).toBe("0xe9ae21ea");
  });

  it("the governor controls the Safe only as an owner with threshold 1", () => {
    expect(decodeSafeControl([GOVERNOR], 1, GOVERNOR.toLowerCase())).toBe(true);
    expect(decodeSafeControl([GOVERNOR, SAFE], 2, GOVERNOR)).toBe(false);
    expect(decodeSafeControl([SAFE], 1, GOVERNOR)).toBe(false);
  });
});

describe("pickManagerRole", () => {
  it("prefers the generation's default role when the manager holds it", () => {
    expect(pickManagerRole(RolesVersion.V1, ["2", "1"])).toEqual({ role: "1", assumed: false });
    const key = ethers.encodeBytes32String("defaulManagerRole");
    expect(pickManagerRole(RolesVersion.V2, [key.toUpperCase().replace("0X", "0x")])).toEqual({
      role: key,
      assumed: false,
    });
  });
  it("takes the role actually held when the default is not among them", () => {
    expect(pickManagerRole(RolesVersion.V1, ["7"])).toEqual({ role: "7", assumed: false });
  });
  it("falls back to the default, flagged, when nothing is held", () => {
    expect(pickManagerRole(RolesVersion.V1, [])).toEqual({ role: "1", assumed: true });
    expect(pickManagerRole(RolesVersion.V2, []).assumed).toBe(true);
  });
});

describe("Proposal pre-flight", () => {
  const v1ScopeTarget = v1.encodeFunctionData("scopeTarget", [1, FUND]);
  const v2ScopeTarget = v2.encodeFunctionData("scopeTarget", [
    ethers.encodeBytes32String("defaulManagerRole"),
    FUND,
  ]);

  it("flags a V1-encoded call aimed at a V2 modifier, and the reverse", () => {
    const calls = toProposalCalls([MODIFIER, FUND], [v1ScopeTarget, UPDATE_NAV_CALLDATA]);
    const problems = checkRolesCallVersions(calls, MODIFIER, RolesVersion.V2);
    expect(Object.keys(problems)).toEqual(["0"]);
    expect(problems[0]).toMatch(/scopeTarget with the Roles v1 ABI.*modifier is Roles v2/);

    const reverse = checkRolesCallVersions(
      toProposalCalls([MODIFIER], [v2ScopeTarget]),
      MODIFIER,
      RolesVersion.V1,
    );
    expect(reverse[0]).toMatch(/Roles v2 ABI.*modifier is Roles v1/);
  });

  it("passes calls that match the deployed generation and ignores other targets", () => {
    expect(
      checkRolesCallVersions(
        toProposalCalls([MODIFIER, FUND], [v2ScopeTarget, v1ScopeTarget]),
        MODIFIER,
        RolesVersion.V2,
      ),
    ).toEqual({});
  });

  it("sums the actions' gas with the governor overhead and compares with the chain cap", () => {
    const ok = summarizeProposalPreflight(
      [
        { index: 0, target: FUND, selector: "0x93a1de3f", ok: true, gas: 4_490_149 },
        { index: 1, target: EXECUTOR, selector: "0xc8361853", ok: true, gas: 943_316 },
      ],
      "0x2105",
      140_000_000,
    );
    expect(ok.ok).toBe(true);
    expect(ok.totalGas).toBe(4_490_149 + 943_316 + GOVERNOR_EXECUTE_OVERHEAD);
    expect(ok.txGasCap).toBe(16_777_216);
    expect(ok.overTxGasCap).toBe(false);
    expect(ok.problems).toEqual([]);

    // The INDEFI case: 26 methods, unmineable on Base.
    const capped = summarizeProposalPreflight(
      [{ index: 0, target: FUND, selector: "0x93a1de3f", ok: true, gas: 18_800_000 }],
      "0x2105",
      140_000_000,
    );
    expect(capped.overTxGasCap).toBe(true);
    expect(capped.problems[0]).toMatch(/caps a transaction at 16.8M/);

    // A chain without a cap only warns about the block limit.
    const hyper = summarizeProposalPreflight(
      [{ index: 0, target: FUND, selector: "0x93a1de3f", ok: true, gas: 4_000_000 }],
      "0x3e7",
      3_000_000,
    );
    expect(hyper.overTxGasCap).toBe(false);
    expect(hyper.overBlockLimit).toBe(true);
  });

  it("reports reverts first and leaves the gas total unknown when an estimate is missing", () => {
    const result = summarizeProposalPreflight(
      [
        { index: 0, target: FUND, selector: "0x93a1de3f", ok: false, reason: "Action 1 reverts: boom" },
        { index: 1, target: FUND, selector: "0xe9ae21ea", ok: true },
      ],
      "0x2105",
    );
    expect(result.ok).toBe(false);
    expect(result.totalGas).toBeUndefined();
    expect(result.problems).toEqual(["Action 1 reverts: boom"]);
    expect(result.warnings[0]).toMatch(/could not be estimated for action 2/);
  });

  it("blocks on a single action that runs uncapped but not within the transaction cap", () => {
    // The INDEFI signature: eth_call succeeds, eth_estimateGas refuses, the
    // call given exactly the cap reverts.
    const result = summarizeProposalPreflight(
      [
        { index: 0, target: FUND, selector: "0x93a1de3f", ok: true, overTxGasCap: true },
        { index: 1, target: EXECUTOR, selector: "0xc8361853", ok: true, gas: 943_316 },
      ],
      "0x2105",
      140_000_000,
    );
    expect(result.ok).toBe(true);
    expect(result.overTxGasCap).toBe(true);
    expect(result.problems[0]).toMatch(/Action 1 \(0x93a1de3f\) alone needs more gas than this chain allows/);
    expect(result.warnings).toEqual([]);
  });
});
