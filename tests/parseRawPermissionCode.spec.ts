import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import { getScopeTargetV2 } from "../composables/nav/generateNAVPermission";
import { generateManageRoleMembersPermissionRolesV2 } from "../composables/permissions/rolesV2Permissions";
import { parseRawPermissionCode } from "../composables/permissions/parseRawPermissionCode";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);
const TARGET = "0x111f164d91e3F8169a7043f7094f44af87Fb7CA4";

describe("parseRawPermissionCode", () => {
  const scopeTarget = getScopeTargetV2("defaulManagerRole", TARGET);
  const [, allowFunction] = generateManageRoleMembersPermissionRolesV2(TARGET);

  it("accepts newline-separated hex entries and labels them", () => {
    const entries = parseRawPermissionCode(
      `${scopeTarget}\n${allowFunction}`,
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].data).toBe(scopeTarget);
    expect(entries[0].label).toContain("scopeTarget");
    expect(entries[0].label).toContain("defaulManagerRole");
    expect(entries[1].label).toContain("allowFunction");
  });

  it("accepts a JSON array of hex strings", () => {
    const entries = parseRawPermissionCode(
      JSON.stringify([scopeTarget, allowFunction]),
    );
    expect(entries.map((e) => e.data)).toEqual([scopeTarget, allowFunction]);
  });

  it("round-trips through the Roles V2 ABI", () => {
    for (const entry of parseRawPermissionCode(scopeTarget)) {
      const parsed = rolesInterface.parseTransaction({ data: entry.data });
      expect(parsed).not.toBeNull();
    }
  });

  it("rejects non-hex, short, and undecodable entries with a 1-based index", () => {
    expect(() => parseRawPermissionCode("not-hex")).toThrow(/Entry 1/);
    expect(() => parseRawPermissionCode("0x1234")).toThrow(/Entry 1/);
    expect(() =>
      parseRawPermissionCode(`${scopeTarget}\n0xdeadbeef00`),
    ).toThrow(/Entry 2 does not decode/);
    expect(() => parseRawPermissionCode("[1, 2]")).toThrow(
      /array of hex strings/,
    );
    expect(() => parseRawPermissionCode("[nope")).toThrow(/not valid JSON/);
  });
});
