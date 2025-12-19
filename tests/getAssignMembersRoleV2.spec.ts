import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import { getAssignMembersRoleV2 } from "../composables/nav/generateNAVPermission";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";

describe("getAssignMembersRoleV2", () => {
  const assignRolesAbi: any = (RolesFullV2 as any).abi.find(
    (f: any) => f?.type === "function" && f?.name === "assignRoles",
  );

  it("encodes assignRoles for each member with default role key", () => {
    const members = [
      { address: "0x111f164d91e3F8169a7043f7094f44af87Fb7CA4", action: "ADD" as const },
      { address: "0x222f164d91e3F8169a7043f7094f44af87Fb7CA4", action: "REMOVE" as const },
    ];

    const entries = getAssignMembersRoleV2(undefined, members);
    expect(entries).toHaveLength(2);

    const roleKeyBytes = ethers.encodeBytes32String("defaulManagerRole");

    const expected0 = encodeFunctionCall(assignRolesAbi, [
      members[0].address,
      [roleKeyBytes],
      [true], // ADD => memberOf true
    ]);
    const expected1 = encodeFunctionCall(assignRolesAbi, [
      members[1].address,
      [roleKeyBytes],
      [false], // REMOVE => memberOf false
    ]);

    expect(entries[0].toLowerCase()).toBe(expected0.toLowerCase());
    expect(entries[1].toLowerCase()).toBe(expected1.toLowerCase());
  });

  it("supports custom role key and empty members", () => {
    // empty list -> no entries
    expect(getAssignMembersRoleV2("customRole", [])).toEqual([]);

    const members = [
      { address: "0x6B6d690F540788b87FC63BD975e6B398da775159", action: "ADD" as const },
    ];
    const entries = getAssignMembersRoleV2("customRole", members);
    expect(entries).toHaveLength(1);

    const roleKeyBytes = ethers.encodeBytes32String("customRole");
    const expected = encodeFunctionCall(assignRolesAbi, [
      members[0].address,
      [roleKeyBytes],
      [true],
    ]);
    expect(entries[0].toLowerCase()).toBe(expected.toLowerCase());
  });
});
