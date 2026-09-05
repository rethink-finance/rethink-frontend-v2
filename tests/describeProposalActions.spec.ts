import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import GnosisSafeL2 from "../assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import SafeMultiSendCallOnly from "../assets/contracts/safe/SafeMultiSendCallOnly.json";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import { GovernableFund } from "../assets/contracts/GovernableFund";
import { decodeProposalCallData } from "../composables/proposal/decodeProposalCallData";
import {
  buildSettingsSections,
  countChangedSettings,
  decodeFlowsCall,
  describeConditionTree,
  describeExecution,
  describePermission,
  formatCompValue,
  formatFeePeriodDays,
  formatFunctionLabel,
  formatRoleKey,
  unpackMultiSend,
  v1ParamLabel,
} from "../composables/proposal/describeProposalActions";
import { ProposalCalldataType } from "../types/enums/proposal_calldata_type";

const SAFE = "0x1111111111111111111111111111111111111111";
const FUND = "0x2222222222222222222222222222222222222222";
const ROLE_MOD = "0x3333333333333333333333333333333333333333";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT = "0x4444444444444444444444444444444444444444";

const erc20 = new ethers.Interface([
  "function transfer(address to, uint256 amount)",
  "function approve(address spender, uint256 amount)",
]);
const multiSend = new ethers.Interface((SafeMultiSendCallOnly as any).abi);
const safe = new ethers.Interface((GnosisSafeL2 as any).abi);
const roles = new ethers.Interface((RolesFullV2 as any).abi);

const pack = (to: string, data: string, value = 0n, operation = 0) =>
  ethers.solidityPacked(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [operation, to, value, ethers.dataLength(data), data],
  );

describe("unpackMultiSend", () => {
  it("splits a packed batch into named calls", () => {
    const transfer = erc20.encodeFunctionData("transfer", [RECIPIENT, 1_000_000n]);
    const approve = erc20.encodeFunctionData("approve", [RECIPIENT, 5n]);
    const packed = ethers.concat([pack(USDC, transfer), pack(USDC, approve, 0n, 1)]);

    const calls = unpackMultiSend(packed);
    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(USDC);
    expect(calls[0].operation).toBe(0);
    expect(calls[0].call.functionName).toBe("transfer");
    expect(calls[0].call.params.map((p) => p.type)).toEqual(["address", "uint256"]);
    expect(String(calls[0].call.params[0].value).toLowerCase()).toBe(RECIPIENT);
    expect(calls[0].call.params[1].value).toBe("1000000");
    expect(calls[1].operation).toBe(1);
    expect(calls[1].call.functionName).toBe("approve");
  });

  it("stops cleanly on a truncated batch", () => {
    const transfer = erc20.encodeFunctionData("transfer", [RECIPIENT, 1n]);
    const packed = pack(USDC, transfer);
    expect(unpackMultiSend(ethers.dataSlice(packed, 0, 60))).toEqual([]);
  });
});

describe("describeExecution", () => {
  it("unwraps a Safe execTransaction around a MultiSend batch", () => {
    const transfer = erc20.encodeFunctionData("transfer", [RECIPIENT, 42n]);
    const batch = multiSend.encodeFunctionData("multiSend", [pack(USDC, transfer)]);
    const calldata = safe.encodeFunctionData("execTransaction", [
      "0x5555555555555555555555555555555555555555",
      0,
      batch,
      1,
      0,
      0,
      0,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      "0x",
    ]);

    const decoded = decodeProposalCallData(ROLE_MOD, calldata, SAFE, SAFE, FUND);
    expect(decoded?.calldataType).toBe(ProposalCalldataType.DIRECT_EXECUTION);

    const execution = describeExecution(decoded?.calldataDecoded);
    expect(execution.isBatch).toBe(true);
    expect(execution.operation).toBe(1);
    expect(execution.calls).toHaveLength(1);
    expect(execution.calls[0].to).toBe(USDC);
    expect(execution.calls[0].call.signature).toBe("transfer(address,uint256)");
    expect(execution.calls[0].call.params[1].value).toBe("42");
  });

  it("treats a non-MultiSend call as a single call", () => {
    const transfer = erc20.encodeFunctionData("transfer", [RECIPIENT, 7n]);
    const execution = describeExecution({ to: USDC, value: "0", data: transfer, operation: "0" });
    expect(execution.isBatch).toBe(false);
    expect(execution.calls[0].call.functionName).toBe("transfer");
  });

  it("leaves an unknown selector undecoded but keeps the bytes", () => {
    const execution = describeExecution({ to: USDC, value: "0", data: "0xdeadbeef00", operation: "0" });
    expect(execution.calls[0].call.functionName).toBeUndefined();
    expect(execution.calls[0].call.selector).toBe("0xdeadbeef");
    expect(execution.calls[0].data).toBe("0xdeadbeef00");
  });
});

describe("classification by function", () => {
  it("treats execTransaction on a foreign Safe as a Safe execution", () => {
    const calldata = safe.encodeFunctionData("approveHash", [ethers.ZeroHash]);
    const other = safe.encodeFunctionData("execTransaction", [
      USDC, 0, "0x", 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, "0x",
    ]);
    const formerSafe = "0x7777777777777777777777777777777777777777";
    expect(decodeProposalCallData(ROLE_MOD, calldata, formerSafe, SAFE, FUND)?.calldataType)
      .toBe(ProposalCalldataType.UNDEFINED);
    expect(decodeProposalCallData(ROLE_MOD, other, formerSafe, SAFE, FUND)?.calldataType)
      .toBe(ProposalCalldataType.DIRECT_EXECUTION);
  });

  it("treats a Roles call on a foreign modifier as a permission", () => {
    const calldata = roles.encodeFunctionData("revokeTarget", [ethers.ZeroHash, USDC]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, RECIPIENT, SAFE, FUND);
    expect(decoded?.calldataType).toBe(ProposalCalldataType.PERMISSIONS);
    expect(decoded?.contractName).toBe("ZodiacRolesV2");
  });
});

describe("decodeFlowsCall", () => {
  const fund = new ethers.Interface(GovernableFund.abi as any);
  const flows = new ethers.Interface([
    "function mintToMany(uint256[] amounts, address[] recipients)",
    "function sweepTokens()",
  ]);

  it("unwraps mintToMany inside fundFlowsCall", () => {
    const inner = flows.encodeFunctionData("mintToMany", [[1_000_000_000_000n], [RECIPIENT]]);
    const calldata = fund.encodeFunctionData("fundFlowsCall", [inner]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, FUND, SAFE, FUND);
    expect(decoded?.functionName).toBe("fundFlowsCall");

    const call = decodeFlowsCall(decoded?.calldataDecoded);
    expect(call?.functionName).toBe("mintToMany");
    expect(call?.params[0].value).toEqual(["1000000000000"]);
    expect((call?.params[1].value as string[])[0].toLowerCase()).toBe(RECIPIENT);
  });

  it("names sweepTokens", () => {
    const inner = flows.encodeFunctionData("sweepTokens", []);
    const calldata = fund.encodeFunctionData("fundFlowsCall", [inner]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, FUND, SAFE, FUND);
    expect(decodeFlowsCall(decoded?.calldataDecoded)?.functionName).toBe("sweepTokens");
  });
});

describe("describePermission (Roles v2)", () => {
  const ROLE_KEY = ethers.encodeBytes32String("manager");

  it("reads assignRoles as memberships", () => {
    const calldata = roles.encodeFunctionData("assignRoles", [
      RECIPIENT,
      [ROLE_KEY, ethers.encodeBytes32String("viewer")],
      [true, false],
    ]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, ROLE_MOD, SAFE, FUND);
    expect(decoded?.calldataType).toBe(ProposalCalldataType.PERMISSIONS);

    const description = describePermission(decoded?.functionName, decoded?.calldataDecoded);
    expect(description.action).toBe("assign-roles");
    expect(description.module?.toLowerCase()).toBe(RECIPIENT);
    expect(description.memberships).toEqual([
      { role: "manager", added: true },
      { role: "viewer", added: false },
    ]);
  });

  it("reads allowFunction with its execution options", () => {
    const calldata = roles.encodeFunctionData("allowFunction", [ROLE_KEY, USDC, "0xa9059cbb", 1]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, ROLE_MOD, SAFE, FUND);
    const description = describePermission(decoded?.functionName, decoded?.calldataDecoded);
    expect(description.action).toBe("allow-function");
    expect(description.tone).toBe("grant");
    expect(description.role).toBe("manager");
    expect(description.selector).toBe("0xa9059cbb");
    expect(description.executionOption).toContain("send ETH");
  });

  it("turns scopeFunction conditions into readable lines", () => {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const conditions = [
      { parent: 0, paramType: 5, operator: 5, compValue: "0x" }, // Calldata / Matches
      { parent: 0, paramType: 1, operator: 16, compValue: coder.encode(["address"], [RECIPIENT]) },
      { parent: 0, paramType: 1, operator: 0, compValue: "0x" }, // Pass
    ];
    const calldata = roles.encodeFunctionData("scopeFunction", [ROLE_KEY, USDC, "0xa9059cbb", conditions, 0]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, ROLE_MOD, SAFE, FUND);
    const description = describePermission(decoded?.functionName, decoded?.calldataDecoded);
    expect(description.action).toBe("scope-function");
    expect(description.conditions?.children).toHaveLength(2);

    const inputs = [...erc20.getFunction("transfer")!.inputs];
    const lines = describeConditionTree(description.conditions, inputs);
    expect(lines).toHaveLength(2);
    expect(lines[0].label).toBe("to (address)");
    expect(lines[0].text).toBe(`must equal ${ethers.getAddress(RECIPIENT)}`);
    expect(lines[1].label).toBe("amount (uint256)");
    expect(lines[1].text).toBe("any value");
    expect(lines[1].muted).toBe(true);
  });

  it("flags ownership transfer as dangerous", () => {
    const calldata = roles.encodeFunctionData("transferOwnership", [RECIPIENT]);
    const decoded = decodeProposalCallData(ROLE_MOD, calldata, ROLE_MOD, SAFE, FUND);
    const description = describePermission(decoded?.functionName, decoded?.calldataDecoded);
    expect(description.action).toBe("transfer-ownership");
    expect(description.tone).toBe("danger");
    expect(description.newOwner?.toLowerCase()).toBe(RECIPIENT);
    expect(description.warning).toBeTruthy();
  });
});

describe("v1ParamLabel", () => {
  const swap = ethers.FunctionFragment.from(
    "function swap(address executor, (address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount) desc, bytes data)",
  );

  it("counts struct fields one by one, like the calldata words", () => {
    const inputs = [...swap.inputs];
    expect(v1ParamLabel(inputs, 0)).toBe("executor");
    expect(v1ParamLabel(inputs, 2)).toBe("desc.dstToken");
    expect(v1ParamLabel(inputs, 5)).toBe("desc.amount");
    expect(v1ParamLabel(inputs, 6)).toBe("data");
  });

  it("falls back to the index without an ABI or past the end", () => {
    expect(v1ParamLabel(undefined, 3)).toBe("parameter at index 3");
    expect(v1ParamLabel([...swap.inputs], 9)).toBe("parameter at index 9");
  });
});

describe("formatFunctionLabel", () => {
  it("prefers names and shortens unnamed tuples", () => {
    expect(formatFunctionLabel("transfer", [{ name: "to", type: "address" }, { name: "", type: "uint256" }]))
      .toBe("transfer(to, uint256)");
    expect(formatFunctionLabel("openTrade", [{ type: "tuple(address,uint32,uint16)" }, { type: "uint16" }]))
      .toBe("openTrade(tuple, uint16)");
  });
});

describe("formatters", () => {
  it("names roles from either version", () => {
    expect(formatRoleKey("1")).toBe("#1");
    expect(formatRoleKey(ethers.encodeBytes32String("defaulManagerRole"))).toBe("defaulManagerRole");
  });

  it("reads untyped comparison words sensibly", () => {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    expect(formatCompValue(coder.encode(["address"], [RECIPIENT]))).toBe(ethers.getAddress(RECIPIENT));
    expect(formatCompValue(coder.encode(["uint256"], [12345n]))).toBe("12345");
    expect(formatCompValue("0x")).toBe("(empty)");
  });

  it("explains the zero fee period", () => {
    expect(formatFeePeriodDays("0")).toBe("365 days (default)");
    expect(formatFeePeriodDays("30")).toBe("30 days");
  });
});

describe("buildSettingsSections", () => {
  const decoded = {
    _fundSettings: {
      depositFee: "50",
      withdrawFee: "0",
      performanceFee: "1000",
      managementFee: "200",
      performaceHurdleRateBps: "0",
      baseToken: USDC,
      safe: SAFE,
      isExternalGovTokenInUse: false,
      isWhitelistedDeposits: true,
      allowedDepositAddrs: [RECIPIENT],
      allowedManagers: [],
      governanceToken: FUND,
      fundAddress: FUND,
      governor: "0x6666666666666666666666666666666666666666",
      fundName: "Alpha Vault",
      fundSymbol: "ALPHA",
      feeCollectors: [SAFE, SAFE, SAFE, SAFE],
    },
    _fundMetadata: JSON.stringify({ description: "New description", plannedSettlementPeriod: "7" }),
    _feePerformancePeriod: "0",
    _feeManagePeriod: "30",
  };

  it("marks only the rows that differ from the vault", () => {
    const sections = buildSettingsSections(decoded, {
      title: "Alpha Vault",
      description: "Old description",
      depositFee: "50",
      withdrawFee: "0",
      performanceFee: "500",
      managementFee: "200",
      performaceHurdleRateBps: "0",
      performancePeriod: "365",
      managementPeriod: "30",
      safeAddress: SAFE,
      governorAddress: "0x6666666666666666666666666666666666666666",
      address: FUND,
      isWhitelistedDeposits: false,
      allowedDepositAddresses: [],
      allowedManagerAddresses: [],
      plannedSettlementPeriod: "7",
    } as any);

    const changed = sections.flatMap((s) => s.rows).filter((r) => r.changed).map((r) => r.key);
    expect(changed).toEqual(
      expect.arrayContaining(["description", "performanceFee", "isWhitelistedDeposits", "whitelist"]),
    );
    expect(changed).not.toContain("performanceFeePeriod"); // 0 and 365 mean the same
    expect(changed).not.toContain("depositFee");
    expect(changed).not.toContain("safe");
    expect(countChangedSettings(sections)).toBe(changed.length);
  });

  it("compares nothing when the vault is not loaded", () => {
    const sections = buildSettingsSections(decoded, undefined);
    expect(countChangedSettings(sections)).toBe(0);
    expect(sections.flatMap((s) => s.rows).every((r) => !r.comparable)).toBe(true);
  });
});
