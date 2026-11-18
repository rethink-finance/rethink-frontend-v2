// Admin role: mint SYC to depositors through the vault, capped by an allowance.
//   adminRole may call  fund.fundFlowsCall(bytes)  only when the bytes are a  mintToMany(uint256[] amounts, address[] recipients)  call,
//   and every amount is drawn from the allowance "sycMint".
import fs from "node:fs";
import { ethers } from "ethers";
import { c, processPermissions, flattenCondition } from "zodiac-roles-sdk";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
/** SNI Yield Claim Vault (Polygon). The calls are for its Roles v2 modifier 0x8A984794a920BBd367B3e54362014dE973200aB0. */
const D = {
  FUND: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007",
  ADMIN_ROLE_KEY: ethers.encodeBytes32String("adminRole"),
};
export const MINT_ALLOWANCE = {
  name: "sycMint",
  balance: ethers.parseEther("3400000"), // one-off room for the retroactive mint (3,246,665 owed on 16 Nov 2026, growing ~40,000 a week)
  refill: ethers.parseEther("50000"), // added every period once the balance is below maxRefill
  maxRefill: ethers.parseEther("150000"), // unused weeks carry over up to here
  period: 7n * 86400n,
};
const KEY = ethers.encodeBytes32String(MINT_ALLOWANCE.name);
const MINT_TO_MANY = ethers.id("mintToMany(uint256[],address[])").slice(0, 10) as `0x${string}`;

const permissions = [{
  targetAddress: D.FUND, signature: "fundFlowsCall(bytes)",
  condition: c.calldataMatches(
    [c.calldataMatches([c.every(c.withinAllowance(KEY as `0x${string}`)), undefined], ["uint256[]", "address[]"], { selector: MINT_TO_MANY })],
    ["bytes"]),
}];
const { targets } = processPermissions(permissions as any);
const out: string[] = [];
for (const t of targets) {
  if (t.clearance !== 2) throw new Error("target not function-scoped");
  out.push(rolesIface.encodeFunctionData("scopeTarget", [D.ADMIN_ROLE_KEY, t.address]));
  for (const f of t.functions) {
    if (f.wildcarded || !f.condition || f.executionOptions !== 0) throw new Error("unexpected function scope");
    const flat = flattenCondition(f.condition).map((n: any) => [n.parent, n.paramType, n.operator, n.compValue ?? "0x"]);
    console.log("condition tree:"); for (const [i, n] of flat.entries()) console.log(`  ${i} parent ${n[0]} type ${n[1]} op ${n[2]} ${n[3]}`);
    out.push(rolesIface.encodeFunctionData("scopeFunction", [D.ADMIN_ROLE_KEY, t.address, f.selector, flat, 0]));
  }
}
out.push(rolesIface.encodeFunctionData("setAllowance", [KEY, MINT_ALLOWANCE.balance, MINT_ALLOWANCE.maxRefill, MINT_ALLOWANCE.refill, MINT_ALLOWANCE.period, 0]));
const dir = `${process.cwd()}/scripts/syc-admin-mint`;
fs.writeFileSync(`${dir}/admin-mint.json`, JSON.stringify(out, null, 2));
fs.writeFileSync(`${dir}/admin-mint-raw.txt`, out.join("\n") + "\n");
console.log(`${out.length} calls written: scopeTarget, scopeFunction, setAllowance`);
