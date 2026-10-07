import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ACROSS_TRANCHES_USDC,
  CRT_V2_ADDR,
  CRT_V2_ROLE_KEYS,
  acrossMaxRelayerShare,
  acrossMinOutput,
  splitIntoAcrossTranches,
  HYPERCORE_ACTION,
  SEND_ASSET_PINNED_BYTES,
  encodeAddApiWallet,
  encodeSendUsdcToEvm,
  encodeUsdClassTransfer,
  hypercoreHeader,
} from "~/composables/execution/crtV2Vault";
import {
  CRT_V2_SELECTORS,
  SEND_ASSET_TO_EVM_REFERENCE,
  bitmaskCompValue,
  bitmaskPrefixWindows,
  buildCrtV2AdminAcrossFix,
  buildCrtV2AdminRawPermissions,
  buildCrtV2ExecutorRawPermissions,
  crtV2RawPermissionsJson,
  crtV2ScopedFunctions,
  executorCoreWriterCondition,
  flattenConditionTree,
} from "~/composables/execution/crtV2Permissions";
import { RolesV2Operator, RolesV2ParameterType } from "~/composables/permissions/rolesV2Permissions";
import { parseRawPermissionCode } from "~/composables/permissions/parseRawPermissionCode";

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);

describe("CRT v2 vault constants", () => {
  it("uses the role keys the modifier was created with", () => {
    expect(ethers.decodeBytes32String(CRT_V2_ROLE_KEYS.admin)).toBe("adminRole");
    expect(ethers.decodeBytes32String(CRT_V2_ROLE_KEYS.executor)).toBe("defaultManagerRole");
  });

  it("encodes HyperCore actions as version 1 + action id + abi fields", () => {
    expect(hypercoreHeader(HYPERCORE_ACTION.usdClassTransfer)).toBe("0x01000007");
    expect(hypercoreHeader(HYPERCORE_ACTION.addApiWallet)).toBe("0x01000009");
    expect(hypercoreHeader(HYPERCORE_ACTION.sendAsset)).toBe("0x0100000d");
    const ct = encodeUsdClassTransfer(1000000n, true);
    expect(ct.startsWith("0x01000007")).toBe(true);
    expect(ct.length).toBe(2 + 8 + 64 * 2);
    const sa = encodeSendUsdcToEvm(100000000n);
    expect(sa.startsWith("0x0100000d")).toBe(true);
    expect(sa.length).toBe(2 + 8 + 64 * 6);
    // destination word carries the USDC system address, both dexes are spot, token 0
    expect(sa.slice(10 + 24, 10 + 64)).toBe(CRT_V2_ADDR.coreBridge.slice(2).toLowerCase());
    expect(sa.slice(10 + 64 * 2 + 56, 10 + 64 * 3)).toBe("ffffffff");
    expect(sa.slice(10 + 64 * 3 + 56, 10 + 64 * 4)).toBe("ffffffff");
    expect(sa.slice(10 + 64 * 4, 10 + 64 * 5)).toBe("0".repeat(64));
    expect(BigInt("0x" + sa.slice(10 + 64 * 5))).toBe(100000000n);
    const aw = encodeAddApiWallet(CRT_V2_ADDR.payout, "carrot valid_until 1800000000000");
    expect(aw.startsWith("0x01000009")).toBe(true);
  });

  it("derives the selectors the v1 whitelist and the audit named", () => {
    expect(CRT_V2_SELECTORS).toEqual({
      approve: "0x095ea7b3",
      transfer: "0xa9059cbb",
      depositV3Now: "0x7aef642c",
      sendRawAction: "0x17938e13",
      depositFor: "0xc23c545a",
      felixDeposit: "0x6e553f65",
      felixWithdraw: "0xb460af94",
      felixRedeem: "0xba087652",
      poolSupply: "0x617ba037",
      poolWithdraw: "0x69328dec",
    });
  });
});

describe("Bitmask conditions", () => {
  it("packs shift, mask and expected into one 32-byte compValue", () => {
    const cv = bitmaskCompValue(4, new Uint8Array([0xff, 0xff]), new Uint8Array([0xab, 0xcd]));
    expect(cv.length).toBe(66);
    expect(cv.slice(2, 6)).toBe("0004");
    expect(cv.slice(6, 36)).toBe("ffff" + "00".repeat(13));
    expect(cv.slice(36, 66)).toBe("abcd" + "00".repeat(13));
    expect(() => bitmaskCompValue(70000, new Uint8Array(1), new Uint8Array(1))).toThrow();
    expect(() => bitmaskCompValue(0, new Uint8Array(16), new Uint8Array(1))).toThrow();
  });

  it("pins the sendAsset prefix in 15-byte windows and leaves the amount open", () => {
    const windows = bitmaskPrefixWindows(SEND_ASSET_TO_EVM_REFERENCE, SEND_ASSET_PINNED_BYTES);
    expect(SEND_ASSET_PINNED_BYTES).toBe(164);
    expect(windows).toHaveLength(11);
    const ref = ethers.getBytes(SEND_ASSET_TO_EVM_REFERENCE);
    windows.forEach((w, i) => {
      expect(w.paramType).toBe(RolesV2ParameterType.Dynamic);
      expect(w.operator).toBe(RolesV2Operator.Bitmask);
      const bytes = ethers.getBytes(w.compValue);
      const shift = (bytes[0] << 8) | bytes[1];
      expect(shift).toBe(i * 15);
      const mask = bytes.slice(2, 17);
      const expected = bytes.slice(17, 32);
      const size = Math.min(15, 164 - shift);
      expect([...mask.slice(0, size)].every((b) => b === 0xff)).toBe(true);
      expect([...mask.slice(size)].every((b) => b === 0)).toBe(true);
      expect([...expected.slice(0, size)]).toEqual([...ref.slice(shift, shift + size)]);
    });
    // The last window stops one byte short of the amount word.
    const last = ethers.getBytes(windows[10].compValue);
    expect(last.slice(2, 17)[13]).toBe(0xff);
    expect(last.slice(2, 17)[14]).toBe(0);
  });

  it("flattens the executor's CoreWriter tree breadth-first with non-decreasing parents", () => {
    const flat = flattenConditionTree(executorCoreWriterCondition());
    expect(flat[0]).toEqual([0, RolesV2ParameterType.Calldata, RolesV2Operator.Matches, "0x"]);
    expect(flat[1].slice(0, 3)).toEqual([0, RolesV2ParameterType.None, RolesV2Operator.Or]);
    // Or → [Bitmask header 0x01000007, And(11 windows)]
    expect(flat[2].slice(0, 3)).toEqual([1, RolesV2ParameterType.Dynamic, RolesV2Operator.Bitmask]);
    expect(flat[2][3].slice(6, 14)).toBe("ffffffff");
    expect(flat[2][3].slice(36, 44)).toBe("01000007");
    expect(flat[3].slice(0, 3)).toEqual([1, RolesV2ParameterType.None, RolesV2Operator.And]);
    expect(flat.slice(4)).toHaveLength(11);
    expect(flat.slice(4).every((c) => c[0] === 3)).toBe(true);
    for (let i = 1; i < flat.length; i++) expect(flat[i][0]).toBeGreaterThanOrEqual(flat[i - 1][0]);
  });
});

describe("CRT v2 raw permission batches", () => {
  const admin = buildCrtV2AdminRawPermissions();
  const executor = buildCrtV2ExecutorRawPermissions();

  it("decode against the Roles V2 ABI the way the Raw code input checks them", () => {
    for (const entries of [admin, executor]) {
      const parsed = parseRawPermissionCode(crtV2RawPermissionsJson(entries));
      expect(parsed).toHaveLength(entries.length);
      expect(parsed.every((p) => /^scope(Target|Function)/.test(p.label))).toBe(true);
    }
  });

  it("name only their own role key, scoped targets, ExecutionOptions.None", () => {
    for (const [entries, key] of [[admin, CRT_V2_ROLE_KEYS.admin], [executor, CRT_V2_ROLE_KEYS.executor]] as const) {
      for (const entry of entries) {
        const parsed = rolesIface.parseTransaction({ data: entry.data })!;
        expect(["scopeTarget", "scopeFunction"]).toContain(parsed.name);
        expect(String(parsed.args[0]).toLowerCase()).toBe(key.toLowerCase());
        if (parsed.name === "scopeFunction") expect(Number(parsed.args[4])).toBe(0);
      }
    }
  });

  it("grant the admin payouts, Across and API wallets only", () => {
    const scopes = crtV2ScopedFunctions(admin).map((s) => `${s.target.toLowerCase()} ${s.selector}`);
    expect(scopes.sort()).toEqual([
      `${CRT_V2_ADDR.coreWriter} ${CRT_V2_SELECTORS.sendRawAction}`,
      `${CRT_V2_ADDR.spokePool.toLowerCase()} ${CRT_V2_SELECTORS.depositV3Now}`,
      `${CRT_V2_ADDR.usdc.toLowerCase()} ${CRT_V2_SELECTORS.approve}`,
      `${CRT_V2_ADDR.usdc.toLowerCase()} ${CRT_V2_SELECTORS.transfer}`,
    ].sort());
    const targets = new Set(admin.map((e) => String(rolesIface.parseTransaction({ data: e.data })!.args[1]).toLowerCase()));
    expect([...targets].sort()).toEqual([CRT_V2_ADDR.coreWriter, CRT_V2_ADDR.spokePool.toLowerCase(), CRT_V2_ADDR.usdc.toLowerCase()].sort());
  });

  it("grant the executor the venues and HyperCore moves, never a transfer out", () => {
    const scopes = crtV2ScopedFunctions(executor);
    expect(scopes.map((s) => s.selector)).not.toContain(CRT_V2_SELECTORS.transfer);
    expect(scopes.map((s) => s.selector)).not.toContain(CRT_V2_SELECTORS.depositV3Now);
    expect(scopes).toHaveLength(8);
    const targets = new Set(executor.map((e) => String(rolesIface.parseTransaction({ data: e.data })!.args[1]).toLowerCase()));
    expect([...targets].sort()).toEqual([CRT_V2_ADDR.cdw, CRT_V2_ADDR.coreWriter, CRT_V2_ADDR.felix, CRT_V2_ADDR.pool, CRT_V2_ADDR.usdc.toLowerCase()].sort());
  });

  it("pin the Across destination once and pair each tranche size with its output floor", () => {
    const entry = admin.find((e) => e.label.startsWith("Across depositV3Now"))!;
    const flat = rolesIface.parseTransaction({ data: entry.data })!.args[3] as any[];
    const coder = ethers.AbiCoder.defaultAbiCoder();
    // And( pinned fields Matches, Or( one Matches per tranche ) )
    expect(Number(flat[0][2])).toBe(RolesV2Operator.And);
    expect(Number(flat[1][1])).toBe(RolesV2ParameterType.Calldata);
    expect(Number(flat[2][2])).toBe(RolesV2Operator.Or);
    const pinned = flat.filter((c) => Number(c[0]) === 1);
    expect(pinned).toHaveLength(11);
    // depositor, recipient, inputToken, outputToken pinned; amounts left to the tranches; chain, relayer, exclusivity and message pinned
    expect(pinned.map((c) => Number(c[2]))).toEqual([16, 16, 16, 16, 0, 0, 16, 16, 0, 16, 16]);
    expect(pinned[1][3]).toBe(coder.encode(["address"], [CRT_V2_ADDR.payout]));
    expect(pinned[0][3]).toBe(coder.encode(["address"], [CRT_V2_ADDR.safe]));
    expect(pinned[6][3]).toBe(coder.encode(["uint256"], [42161]));
    expect(pinned[7][3]).toBe(coder.encode(["address"], [ethers.ZeroAddress]));
    expect(pinned[9][3]).toBe(coder.encode(["uint32"], [0]));
    expect(pinned[10][3]).toBe(coder.encode(["bytes"], ["0x"]));
    const branches = flat.map((c, i) => [c, i] as const).filter(([c]) => Number(c[0]) === 2).map(([, i]) => i);
    expect(branches).toHaveLength(ACROSS_TRANCHES_USDC.length);
    branches.forEach((b, k) => {
      const kids = flat.filter((c) => Number(c[0]) === b);
      expect(kids).toHaveLength(11);
      const size = BigInt(ACROSS_TRANCHES_USDC[k]) * 1000000n;
      expect(Number(kids[4][2])).toBe(RolesV2Operator.EqualTo);
      expect(kids[4][3]).toBe(coder.encode(["uint256"], [size]));
      expect(Number(kids[5][2])).toBe(RolesV2Operator.GreaterThan);
      expect(kids[5][3]).toBe(coder.encode(["uint256"], [acrossMinOutput(size) - 1n]));
      expect(kids.filter((_, i) => i !== 4 && i !== 5).every((c) => Number(c[2]) === RolesV2Operator.Pass)).toBe(true);
    });
    expect(flat.length).toBeLessThanOrEqual(130);
  });

  it("exports the Across fix as the one depositV3Now scope", () => {
    const fix = buildCrtV2AdminAcrossFix();
    expect(fix).toHaveLength(1);
    const parsed = rolesIface.parseTransaction({ data: fix[0].data })!;
    expect(parsed.name).toBe("scopeFunction");
    expect(String(parsed.args[1]).toLowerCase()).toBe(CRT_V2_ADDR.spokePool.toLowerCase());
    expect(parsed.args[2]).toBe(CRT_V2_SELECTORS.depositV3Now);
    expect(fix[0].data).toBe(admin.find((e) => e.label.startsWith("Across depositV3Now"))!.data);
  });

  it("export a JSON array of hex strings", () => {
    const json = JSON.parse(crtV2RawPermissionsJson(admin));
    expect(Array.isArray(json)).toBe(true);
    expect(json.every((x: string) => /^0x[0-9a-f]+$/i.test(x))).toBe(true);
  });
});

describe("Across tranches", () => {
  const u = (v: number | string) => ethers.parseUnits(String(v), 6);

  it("caps the relayer's share at 0.25 USDC + 0.05 %", () => {
    expect(acrossMaxRelayerShare(u(100))).toBe(u("0.3"));
    expect(acrossMaxRelayerShare(u(2000))).toBe(u("1.25"));
    expect(acrossMaxRelayerShare(u(50000))).toBe(u("25.25"));
    expect(acrossMinOutput(u(50000))).toBe(u("49974.75"));
  });

  it("splits an amount greedily, largest first, and leaves what is under 100 USDC", () => {
    expect(splitIntoAcrossTranches(u(4000))).toEqual({ tranches: [u(2000), u(2000)], remainder: 0n });
    expect(splitIntoAcrossTranches(u("4237.55"))).toEqual({ tranches: [u(2000), u(2000), u(200)], remainder: u("37.55") });
    expect(splitIntoAcrossTranches(u(99))).toEqual({ tranches: [], remainder: u(99) });
    const big = splitIntoAcrossTranches(u(123456));
    expect(big.tranches.map((t) => Number(t / 1000000n))).toEqual([50000, 50000, 20000, 2000, 1000, 200, 200]);
    expect(big.remainder).toBe(u(56));
    expect(big.tranches.reduce((a, b) => a + b, 0n) + big.remainder).toBe(u(123456));
  });
});
