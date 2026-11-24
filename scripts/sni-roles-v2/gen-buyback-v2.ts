// Buyback-Executor, second version: 0.5 WETH a day instead of 0.1, and a second way to buy, Uniswap, next to 1inch.
//
//   1. setAllowance(sniBuybackWethDaily): 0.5 WETH, refilled to 0.5 every UTC day, no carry-over (as before).
//   2. scopeFunction(Buyback-Executor, 1inch v6, unoswapTo2): as stored, with the cap raised to 0.5 WETH.
//   3. scopeTarget(Buyback-Executor, SwapRouter02)
//   4. scopeFunction(Buyback-Executor, SwapRouter02, exactInput): path is one of the four WETH -> USDC -> SNI paths,
//      recipient is the Safe, amountIn is at most 0.5 WETH and drawn from the same allowance.
//
// Both routes share the one allowance: 0.5 WETH a day in total. The Safe already approved WETH to 1inch; an
// Executor approves WETH to SwapRouter02 once (the Executor role may).
//
//   npx esbuild scripts/sni-roles-v2/gen-buyback-v2.ts --bundle --platform=node --format=cjs --alias:~="$PWD" --outfile=node_modules/.cache/gen-buyback-v2.cjs && node node_modules/.cache/gen-buyback-v2.cjs
import { ethers } from "ethers";
import fs from "node:fs";
import { c, processPermissions, flattenCondition } from "zodiac-roles-sdk";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import * as D from "./defs";

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const U = undefined;
// The SDK types `or` by arity; a list of alternatives goes through a loose call.
const anyOf = (values: string[]) => (c.or as (...branches: string[]) => unknown)(...values);
export const BUYBACK_MAX_V2 = ethers.parseEther("0.5");
const KEY = D.BUYBACK_ALLOWANCE_KEY as `0x${string}`;
const spend = c.and(c.lte(BUYBACK_MAX_V2), c.withinAllowance(KEY));
const BUY_PATHS = D.WETH_USDC_FEES.map((fee) => D.packPath([D.WETH, fee, D.USDC, D.SNI_USDC_FEE, D.SNI]));

const perms: any[] = [
  { targetAddress: D.ONEINCH_V6, signature: D.SIG.unoswapTo2,
    condition: c.calldataMatches([BigInt(D.SAFE), BigInt(D.WETH), spend, U, D.ONEINCH_DEX_WETH_USDC, D.ONEINCH_DEX_SNI_USDC],
      ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"]) },
  { targetAddress: D.SWAP_ROUTER_02, signature: D.SIG.exactInput,
    condition: c.calldataMatches([c.matches([anyOf(BUY_PATHS), D.SAFE, spend, U])], ["(bytes,address,uint256,uint256)"]) },
];
const { targets } = processPermissions(perms);
const out: string[] = [];
out.push(rolesIface.encodeFunctionData("setAllowance", [KEY, BUYBACK_MAX_V2, BUYBACK_MAX_V2, BUYBACK_MAX_V2, D.BUYBACK_PERIOD, D.BUYBACK_ANCHOR]));
for (const t of targets) {
  if (t.clearance !== 2) throw new Error("clearance");
  // 1inch is already scoped as a target for this role; only the router is new.
  if (ethers.getAddress(t.address) === D.SWAP_ROUTER_02) out.push(rolesIface.encodeFunctionData("scopeTarget", [D.ROLE3_KEY, t.address]));
  for (const f of t.functions) {
    if (f.wildcarded || !f.condition || f.executionOptions !== 0) throw new Error("scope");
    const flat = flattenCondition(f.condition).map((n: any) => [n.parent, n.paramType, n.operator, n.compValue ?? "0x"]);
    console.log(`${t.address} ${f.selector}`); for (const [i, n] of flat.entries()) console.log(`  ${i} parent ${n[0]} type ${n[1]} op ${n[2]} ${String(n[3]).slice(0, 80)}`);
    out.push(rolesIface.encodeFunctionData("scopeFunction", [D.ROLE3_KEY, t.address, f.selector, flat, 0]));
  }
}
const dir = `${process.cwd()}/scripts/sni-roles-v2`;
fs.writeFileSync(`${dir}/buyback-v2.json`, JSON.stringify(out, null, 2));
fs.writeFileSync(`${dir}/buyback-v2-raw.txt`, out.join("\n") + "\n");
const factory = new ethers.Interface(["function submitPermissions(bytes[])"]);
fs.writeFileSync(`${dir}/buyback-v2-submit.txt`, factory.encodeFunctionData("submitPermissions", [out]) + "\n");
console.log(`${out.length} calls: setAllowance, scopeFunction(1inch), scopeTarget(router), scopeFunction(router). submitPermissions calldata in buyback-v2-submit.txt`);
