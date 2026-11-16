import { load, ethers } from "./lib.mjs";
const { rows } = load("polygon-transfers");
const f = (r) => Number(ethers.formatUnits(r.amount, r.decimals));
const short = (a) => a.slice(0, 8);
// group by safe/token/dir and counterparty
const groups = {};
for (const r of rows) {
  const cp = r.dir === "in" ? r.from : r.to;
  const k = `${r.safe} ${r.token} ${r.dir} ${cp}`;
  (groups[k] ??= { n: 0, sum: 0, first: r.time, last: r.time }).n++;
  groups[k].sum += f(r); groups[k].last = r.time;
}
for (const [k, g] of Object.entries(groups).sort()) console.log(k.padEnd(70), String(g.n).padStart(4), g.sum.toFixed(4).padStart(18), g.first.slice(0,10), g.last.slice(0,10));
console.log("\n--- WETH in (all) ---");
for (const r of rows.filter((r) => r.token === "WETH" && r.dir === "in")) console.log(r.time, r.safe, short(r.from), f(r).toFixed(6), r.tx);
console.log("\n--- new safe all ---");
for (const r of rows.filter((r) => r.safe === "new")) console.log(r.time, r.token, r.dir, short(r.from), short(r.to), f(r).toFixed(4), r.tx);
console.log("\n--- old safe SNI out / USDC ---");
for (const r of rows.filter((r) => r.safe === "old" && ((r.token === "SNI" && r.dir === "out") || r.token === "USDC"))) console.log(r.time, r.token, r.dir, short(r.from), short(r.to), f(r).toFixed(4), r.tx);
