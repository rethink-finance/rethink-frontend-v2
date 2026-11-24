// The Roles v2 permission for minting SYC to sniETH depositors.
//
// One role, "SYC-Distributor", able to do one thing: make the Safe call  vault.fundFlowsCall(bytes)  when the
// bytes are a mintToMany(uint256[],address[]) call. No amount limit. First member: the admin multisig. Later:
// the audited contracts.
//
// The admin role may add and remove its members, the same way it already adds and removes Executors and admins
// (assignRoles through the Safe). It cannot change what the role is allowed to do: scoping is the modifier
// owner's call.
//
// assignRoles is also the modifier owner's call and the admin role acts through the Safe, so swapping members
// works once the Safe owns the modifier (after finalize the governor owns it; a governance vote hands it over).
// Until then the member is the one stored here.
//
//   node <bundle>     writes role-calls.json and role-calls-raw.txt (one call per line, for the Raw permissions box)
import fs from "node:fs";
import { ethers } from "ethers";
import { c, processPermissions, flattenCondition } from "zodiac-roles-sdk";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const key = (name: string) => ethers.encodeBytes32String(name) as `0x${string}`;
export const ROLE = "SYC-Distributor";
const FUND = "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007";
const ROLES_MOD = "0x8A984794a920BBd367B3e54362014dE973200aB0";
const ADMIN_SAFE = "0x78E35296B8C0d0e31EF3584504289B4908416dc8";
const MINT_TO_MANY = ethers.id("mintToMany(uint256[],address[])").slice(0, 10) as `0x${string}`;

const out: string[] = [];
const scope = (role: string, targetAddress: string, signature: string, condition: unknown, withTarget: boolean) => {
  const { targets } = processPermissions([{ targetAddress, signature, condition }] as any);
  for (const t of targets) {
    if (t.clearance !== 2) throw new Error("target not function-scoped");
    if (withTarget) out.push(rolesIface.encodeFunctionData("scopeTarget", [key(role), t.address]));
    for (const f of t.functions) {
      if (f.wildcarded || !f.condition || f.executionOptions !== 0) throw new Error("unexpected function scope");
      const flat = flattenCondition(f.condition).map((n: any) => [n.parent, n.paramType, n.operator, n.compValue ?? "0x"]);
      console.log(`${role}, ${signature}:`);
      for (const [i, n] of flat.entries()) console.log(`  ${i} parent ${n[0]} type ${n[1]} op ${n[2]} ${n[3]}`);
      out.push(rolesIface.encodeFunctionData("scopeFunction", [key(role), t.address, f.selector, flat, 0]));
    }
  }
};
// ---- the mint role
scope(
  ROLE,
  FUND,
  "fundFlowsCall(bytes)",
  c.calldataMatches([c.calldataMatches([undefined, undefined], ["uint256[]", "address[]"], { selector: MINT_TO_MANY })], ["bytes"]),
  true,
);
// ---- the admin role: members of the mint role, next to the Executors and admins it manages today
scope(
  "adminRole",
  ROLES_MOD,
  "assignRoles(address,bytes32[],bool[])",
  c.calldataMatches(
    [undefined, c.or(c.eq([key("defaultManagerRole")]), c.eq([key("adminRole")]), c.eq([key(ROLE)])), undefined],
    ["address", "bytes32[]", "bool[]"],
  ),
  false,
);
// ---- the first member
out.push(rolesIface.encodeFunctionData("assignRoles", [ADMIN_SAFE, [key(ROLE)], [true]]));

const dir = `${process.cwd()}/scripts/syc-distributor/role`;
fs.writeFileSync(`${dir}/role-calls.json`, JSON.stringify(out, null, 2));
fs.writeFileSync(`${dir}/role-calls-raw.txt`, out.join("\n") + "\n");
console.log(`${out.length} calls written to role/role-calls.json and role/role-calls-raw.txt`);
